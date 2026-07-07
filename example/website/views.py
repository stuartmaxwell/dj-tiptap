"""Website views."""

from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.template.response import TemplateResponse
from django.views.generic import View
from PIL import Image, UnidentifiedImageError

from dj_tiptap import conf
from website import forms, models


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
    """POST multipart {file} -> JSON {id, url, alt, width, height}.

    Errors are always {"error": "<message>"} with status 400.
    POC note: open to anonymous users; add LoginRequiredMixin before real use.
    """

    def post(self, request):
        max_upload_mb = conf.max_upload_size_mb()
        allowed_types = conf.allowed_image_types()

        upload = request.FILES.get("file")
        if upload is None:
            return JsonResponse({"error": "No file provided."}, status=400)
        if upload.size > max_upload_mb * 1024 * 1024:
            return JsonResponse(
                {"error": f"File too large (max {max_upload_mb} MB)."},
                status=400,
            )

        try:
            image = Image.open(upload)
            # Read format and dimensions from the header before verify(),
            # which consumes the stream and invalidates the Image object.
            image_format = image.format
            width, height = image.size
            image.verify()

        except UnidentifiedImageError:
            return JsonResponse({"error": "File is not a recognisable image."}, status=400)

        if image_format not in allowed_types:
            return JsonResponse({"error": f"Unsupported image format: {image_format}."}, status=400)

        upload.seek(0)  # rewind after verify(), or the stored file is truncated

        attachment = models.Attachment.objects.create(
            file=upload,
            original_filename=upload.name,
            content_type=allowed_types[image_format],
            file_size=upload.size,
            width=width,
            height=height,
        )

        return JsonResponse(
            {
                "id": attachment.id,
                "url": attachment.file.url,
                "alt": attachment.alt_text,
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
