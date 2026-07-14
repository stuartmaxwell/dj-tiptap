"""Website views."""

from typing import TYPE_CHECKING

import puremagic
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.template.response import TemplateResponse
from django.views.generic import View
from PIL import Image, UnidentifiedImageError

from dj_tiptap import conf
from website import forms, models

if TYPE_CHECKING:
    from django.core.files.uploadedfile import UploadedFile


class HomeView(View):
    """Home view displaying recent posts."""

    def get(self, request):
        posts = models.Post.objects.all()
        return TemplateResponse(request, "website/home.html", {"posts": posts})


class PostView(View):
    """View a single post."""

    def get(self, request, pk):
        post = get_object_or_404(models.Post, pk=pk)
        return TemplateResponse(request, "website/post.html", {"post": post})


class PostCreateView(View):
    """Create a new post."""

    def get(self, request):
        form = forms.PostForm()

        return TemplateResponse(request, "website/post_form.html", {"form": form})

    def post(self, request):
        form = forms.PostForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("website:home")

        return TemplateResponse(request, "website/post_form.html", {"form": form})


class PostUpdateView(View):
    """Update an existing post."""

    def get(self, request, pk):
        post = get_object_or_404(models.Post, pk=pk)
        form = forms.PostForm(instance=post)

        return TemplateResponse(request, "website/post_form.html", {"form": form, "post": post})

    def post(self, request, pk):
        post = get_object_or_404(models.Post, pk=pk)
        form = forms.PostForm(request.POST, instance=post)
        if form.is_valid():
            form.save()
            return redirect("website:home")

        return TemplateResponse(request, "website/post_form.html", {"form": form, "post": post})


class AttachmentUploadView(View):
    """POST multipart {file} -> JSON {id, url, alt, content_type, width, height}.

    The pipeline: identify() sniffs the mime type from the file's magic
    numbers (puremagic), then post() dispatches to handle_<kind> for the
    mime's top-level type — so accepting a new kind of attachment means
    writing one more handler method (e.g. handle_audio). Each handler owns
    its allow-list and size limit and ends by calling store().

    Images get a second, deeper pass with Pillow inside handle_image: it
    yields the dimensions and catches corrupt files, which magic numbers
    can't. Videos are stored with width/height None, which also keeps them
    out of the image picker (see AttachmentBrowseView).

    Errors are always {"error": "<message>"} with status 400.
    POC note: open to anonymous users; add LoginRequiredMixin before real use.
    """

    def post(self, request) -> JsonResponse:
        upload = request.FILES.get("file")
        if upload is None:
            return JsonResponse({"error": "No file provided."}, status=400)

        content_type = self.identify(upload)
        handler = getattr(self, f"handle_{content_type.partition('/')[0]}", None)
        if handler is None:
            return JsonResponse({"error": "File is not a recognisable image or video."}, status=400)

        return handler(upload, content_type)

    @staticmethod
    def identify(upload: UploadedFile) -> str:
        """Identify the file type using puremagic.

        Args:
            upload: The uploaded file to identify.

        Returns:
            The identified content type, or an empty string if unrecognised.
        """
        try:
            # All matches ordered by confidence; an unrecognised file yields an empty list (or PureError on some inputs)
            matches = puremagic.magic_stream(upload, filename=upload.name)

        except puremagic.PureError:
            matches = []

        upload.seek(0)  # rewind the header read; handlers expect a fresh stream

        # Some low-confidence matches carry no mime type; skip those.
        return next((m.mime_type for m in matches if m.mime_type), "")

    @staticmethod
    def size_error(upload: UploadedFile, max_upload_mb: int) -> JsonResponse | None:
        """The error response for an oversized upload.

        Args:
            upload: The uploaded file to check.
            max_upload_mb: The maximum allowed size in MB.

        Returns:
            A JsonResponse with an error message if the upload is too large, or None if within the limit.
        """
        if upload.size > max_upload_mb * 1024 * 1024:
            return JsonResponse(
                {"error": f"File too large (max {max_upload_mb} MB)."},
                status=400,
            )

        return None

    def handle_image(self, upload: UploadedFile, _content_type: str) -> JsonResponse:
        """Image handlre.

        Validates an image with Pillow.

        Args:
            upload: The uploaded file to handle.
            _content_type: The content type of the upload (unused).

        Returns:
            A JsonResponse with an error message if the image is invalid, or None if the image is valid.
        """
        try:
            image = Image.open(upload)
            # Read format and dimensions from the header before verify(), which consumes the stream and invalidates the
            # Image object.
            image_format = image.format
            width, height = image.size
            image.verify()

        except UnidentifiedImageError:
            return JsonResponse({"error": "File is not a recognisable image or video."}, status=400)

        allowed_types = conf.allowed_image_types()
        if image_format not in allowed_types:
            return JsonResponse({"error": f"Unsupported image format: {image_format}."}, status=400)

        if error := self.size_error(upload, conf.max_upload_size_mb()):
            return error

        return self.store(upload, allowed_types[image_format], width=width, height=height)

    def handle_video(self, upload: UploadedFile, content_type: str) -> JsonResponse:
        """Video handler.

        Validate a video: the magic-number identification is the whole check.

        Args:
            upload: The uploaded file to handle.
            content_type: The content type of the upload.

        Returns:
            A JsonResponse with an error message if the video is invalid, or None if the video is valid.
        """
        if content_type not in conf.allowed_video_types():
            # e.g. video/quicktime: a real video, just not a web-playable one
            return JsonResponse({"error": f"Unsupported video format: {content_type}."}, status=400)

        if error := self.size_error(upload, conf.max_video_upload_size_mb()):
            return error

        return self.store(upload, content_type)

    def store(
        self,
        upload: UploadedFile,
        content_type: str,
        width: int | None = None,
        height: int | None = None,
    ) -> JsonResponse:
        """Create the Attachment.

        Args:
            upload: The uploaded file to store.
            content_type: The content type of the upload.
            width: The width of the image/video, if applicable.
            height: The height of the image/video, if applicable.

        Returns:
            A JsonResponse with the attachment's ID and URL.
        """
        upload.seek(0)  # rewind after detection, or the stored file is truncated

        attachment = models.Attachment.objects.create(
            file=upload,
            original_filename=upload.name,
            content_type=content_type,
            file_size=upload.size,
            width=width,
            height=height,
        )

        return JsonResponse(
            {
                "id": attachment.id,
                "url": attachment.file.url,
                "alt": attachment.alt_text,
                "content_type": content_type,
                "width": width,
                "height": height,
            },
            status=201,
        )


class AttachmentBrowseView(View):
    """GET ?page=N -> server-rendered thumbnail-grid fragment for the picker dialog."""

    def get(self, request):
        # exclude(width=None) keeps future non-image attachments out of the image picker
        paginator = Paginator(models.Attachment.objects.exclude(width=None), 24)
        page = paginator.get_page(request.GET.get("page"))
        return TemplateResponse(request, "website/attachment_browse.html", {"page": page})
