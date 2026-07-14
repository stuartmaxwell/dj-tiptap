"""Tests for the example project's attachment upload and browse endpoints.

These views live in the example website app rather than the package: they are
the reference implementation of the endpoint contracts documented in
dj_tiptap.conf (upload: POST multipart {file} -> 201 {url, alt?, ...} or
4xx {error}; browse: HTML fragment honouring the picker's data attributes).
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from PIL import Image
from website import models

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def image_upload(name="test.png", image_format="PNG", size=(4, 4)):
    """Build a small real image as an uploaded file."""
    buffer = io.BytesIO()
    Image.new("RGB", size, "red").save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue())


# Just enough of an MP4/MOV header for puremagic's magic-number check: the
# ftyp box with a major brand. The brand decides the mime type (isom ->
# video/mp4, "qt  " -> video/quicktime).
def video_upload(name="clip.mp4", brand=b"isom"):
    """Build a minimal file with a valid MP4-family signature."""
    data = b"\x00\x00\x00\x18ftyp" + brand + b"\x00\x00\x02\x00" + brand + b"\x00" * 32
    return SimpleUploadedFile(name, data)


class TestAttachmentUpload:
    """Upload endpoint: validation, metadata capture, and error shapes."""

    def test_upload_png_creates_attachment(self, client):
        response = client.post("/attachments/upload/", {"file": image_upload()})

        assert response.status_code == 201
        data = response.json()
        attachment = models.Attachment.objects.get(pk=data["id"])
        assert data["url"] == attachment.file.url
        assert data["alt"] == "test"
        assert (data["width"], data["height"]) == (4, 4)
        assert attachment.original_filename == "test.png"
        assert attachment.content_type == "image/png"
        assert "attachments/" in attachment.file.name
        # The stored file must not be truncated by the Pillow verify() pass
        assert attachment.file.size > 0
        assert attachment.file_size == attachment.file.size

    def test_upload_jpeg_accepted(self, client):
        upload = image_upload("photo.jpg", image_format="JPEG")
        response = client.post("/attachments/upload/", {"file": upload})
        assert response.status_code == 201

    def test_get_not_allowed(self, client):
        assert client.get("/attachments/upload/").status_code == 405

    def test_missing_file_rejected(self, client):
        response = client.post("/attachments/upload/")
        assert response.status_code == 400
        assert response.json() == {"error": "No file provided."}

    def test_non_media_rejected(self, client):
        upload = SimpleUploadedFile("notes.txt", b"not an image or video")
        response = client.post("/attachments/upload/", {"file": upload})
        assert response.status_code == 400
        assert "not a recognisable image or video" in response.json()["error"]

    def test_unsupported_format_rejected(self, client):
        upload = image_upload("scan.bmp", image_format="BMP")
        response = client.post("/attachments/upload/", {"file": upload})
        assert response.status_code == 400
        assert "Unsupported image format: BMP" in response.json()["error"]

    def test_oversized_file_rejected(self, client, settings):
        # With the limit at 0 MB any real file is too large — no need to
        # build a 10 MB blob (and this proves the view reads the setting
        # at request time rather than at import).
        settings.DJ_TIPTAP_MAX_UPLOAD_SIZE_MB = 0
        response = client.post("/attachments/upload/", {"file": image_upload()})
        assert response.status_code == 400
        assert response.json()["error"] == "File too large (max 0 MB)."

    def test_csrf_enforced(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post("/attachments/upload/", {"file": image_upload()})
        assert response.status_code == 403
        assert not models.Attachment.objects.exists()


class TestVideoUpload:
    """Video branch of the upload endpoint: magic-byte validation, metadata."""

    def test_upload_mp4_creates_attachment(self, client):
        response = client.post("/attachments/upload/", {"file": video_upload()})

        assert response.status_code == 201
        data = response.json()
        attachment = models.Attachment.objects.get(pk=data["id"])
        assert data["url"] == attachment.file.url
        assert data["alt"] == "clip"
        assert data["content_type"] == "video/mp4"
        # No dimensions for videos — this is also what keeps them out of the
        # image picker (browse excludes width=None)
        assert data["width"] is None
        assert data["height"] is None
        assert attachment.content_type == "video/mp4"
        assert attachment.original_filename == "clip.mp4"
        # The stored file must not be truncated by the detection reads
        assert attachment.file_size == attachment.file.size

    def test_unsupported_video_format_rejected(self, client):
        # QuickTime is a real video type but not web-playable, so it's not in
        # the default allow-list
        upload = video_upload("clip.mov", brand=b"qt  ")
        response = client.post("/attachments/upload/", {"file": upload})
        assert response.status_code == 400
        assert "Unsupported video format: video/quicktime" in response.json()["error"]

    def test_video_types_configurable(self, client, settings):
        settings.DJ_TIPTAP_ALLOWED_VIDEO_TYPES = set()
        response = client.post("/attachments/upload/", {"file": video_upload()})
        assert response.status_code == 400

    def test_oversized_video_rejected(self, client, settings):
        settings.DJ_TIPTAP_MAX_VIDEO_UPLOAD_SIZE_MB = 0
        response = client.post("/attachments/upload/", {"file": video_upload()})
        assert response.status_code == 400
        assert response.json()["error"] == "File too large (max 0 MB)."

    def test_video_size_limit_independent_of_image_limit(self, client, settings):
        # A 0 MB *image* limit must not block video uploads
        settings.DJ_TIPTAP_MAX_UPLOAD_SIZE_MB = 0
        response = client.post("/attachments/upload/", {"file": video_upload()})
        assert response.status_code == 201

    def test_videos_excluded_from_image_browse(self, client):
        client.post("/attachments/upload/", {"file": video_upload()})
        client.post("/attachments/upload/", {"file": image_upload()})
        response = client.get("/attachments/browse/")
        assert response.text.count("data-image-url") == 1


class TestAttachmentBrowse:
    """Browse endpoint: fragment rendering and pagination."""

    def test_empty_library(self, client):
        response = client.get("/attachments/browse/")
        assert response.status_code == 200
        assert "No images yet" in response.text

    def test_grid_and_pagination(self, client):
        for i in range(25):  # one more than a full page
            client.post("/attachments/upload/", {"file": image_upload(f"img{i}.png")})

        response = client.get("/attachments/browse/")
        assert response.text.count("data-image-url") == 24
        assert 'data-fetch="?page=2"' in response.text

        response = client.get("/attachments/browse/?page=2")
        assert response.text.count("data-image-url") == 1
        assert 'data-fetch="?page=1"' in response.text

    def test_bad_page_number_clamps(self, client):
        client.post("/attachments/upload/", {"file": image_upload()})
        response = client.get("/attachments/browse/?page=999")
        assert response.status_code == 200
        assert "Page 1 of 1" in response.text
