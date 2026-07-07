"""Tests for the attachment upload and browse endpoints."""

import io
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image

from website import models
from website.widgets import DjTiptapWidget

TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="dj-tiptap-test-media-")


def image_upload(name="test.png", image_format="PNG", size=(4, 4)):
    """Build a small real image as an uploaded file."""
    buffer = io.BytesIO()
    Image.new("RGB", size, "red").save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue())


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class AttachmentUploadTests(TestCase):
    """Upload endpoint: validation, metadata capture, and error shapes."""

    def test_upload_png_creates_attachment(self):
        response = self.client.post("/attachments/upload/", {"file": image_upload()})

        self.assertEqual(response.status_code, 201)
        data = response.json()
        attachment = models.Attachment.objects.get(pk=data["id"])
        self.assertEqual(data["url"], attachment.file.url)
        self.assertEqual(data["alt"], "test")
        self.assertEqual((data["width"], data["height"]), (4, 4))
        self.assertEqual(attachment.original_filename, "test.png")
        self.assertEqual(attachment.content_type, "image/png")
        self.assertIn("attachments/", attachment.file.name)
        # The stored file must not be truncated by the Pillow verify() pass
        self.assertGreater(attachment.file.size, 0)
        self.assertEqual(attachment.file_size, attachment.file.size)

    def test_upload_jpeg_accepted(self):
        upload = image_upload("photo.jpg", image_format="JPEG")
        response = self.client.post("/attachments/upload/", {"file": upload})
        self.assertEqual(response.status_code, 201)

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get("/attachments/upload/").status_code, 405)

    def test_missing_file_rejected(self):
        response = self.client.post("/attachments/upload/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "No file provided."})

    def test_non_image_rejected(self):
        upload = SimpleUploadedFile("notes.txt", b"not an image")
        response = self.client.post("/attachments/upload/", {"file": upload})
        self.assertEqual(response.status_code, 400)
        self.assertIn("not a recognisable image", response.json()["error"])

    def test_unsupported_format_rejected(self):
        upload = image_upload("scan.bmp", image_format="BMP")
        response = self.client.post("/attachments/upload/", {"file": upload})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported image format: BMP", response.json()["error"])

    @override_settings(DJ_TIPTAP_MAX_UPLOAD_SIZE_MB=0)
    def test_oversized_file_rejected(self):
        # With the limit at 0 MB any real file is too large — no need to
        # build a 10 MB blob (and this proves the view reads the setting
        # at request time rather than at import).
        response = self.client.post("/attachments/upload/", {"file": image_upload()})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "File too large (max 0 MB).")

    def test_csrf_enforced(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post("/attachments/upload/", {"file": image_upload()})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(models.Attachment.objects.exists())


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class AttachmentBrowseTests(TestCase):
    """Browse endpoint: fragment rendering and pagination."""

    def test_empty_library(self):
        response = self.client.get("/attachments/browse/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "No images yet")

    def test_grid_and_pagination(self):
        for i in range(25):  # one more than a full page
            self.client.post("/attachments/upload/", {"file": image_upload(f"img{i}.png")})

        response = self.client.get("/attachments/browse/")
        self.assertContains(response, "data-image-url", count=24)
        self.assertContains(response, 'data-fetch="?page=2"')

        response = self.client.get("/attachments/browse/?page=2")
        self.assertContains(response, "data-image-url", count=1)
        self.assertContains(response, 'data-fetch="?page=1"')

    def test_bad_page_number_clamps(self):
        self.client.post("/attachments/upload/", {"file": image_upload()})
        response = self.client.get("/attachments/browse/?page=999")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Page 1 of 1")


class WidgetConfigTests(TestCase):
    """Endpoint URL resolution: widget argument > setting > built-in default."""

    def test_defaults_use_builtin_views(self):
        html = DjTiptapWidget().render("content", "")
        self.assertIn('data-upload-url="/attachments/upload/"', html)
        self.assertIn('data-browse-url="/attachments/browse/"', html)

    @override_settings(DJ_TIPTAP_UPLOAD_URL="/cdn/upload/", DJ_TIPTAP_BROWSE_URL="/cdn/browse/")
    def test_settings_override_defaults(self):
        html = DjTiptapWidget().render("content", "")
        self.assertIn('data-upload-url="/cdn/upload/"', html)
        self.assertIn('data-browse-url="/cdn/browse/"', html)

    @override_settings(DJ_TIPTAP_UPLOAD_URL="/cdn/upload/")
    def test_widget_argument_beats_setting(self):
        html = DjTiptapWidget(upload_url="/special/upload/").render("content", "")
        self.assertIn('data-upload-url="/special/upload/"', html)

    def test_url_names_are_reversed(self):
        # LOGIN_URL semantics: a URL name works as well as a path
        html = DjTiptapWidget(upload_url="website:attachment_upload").render("content", "")
        self.assertIn('data-upload-url="/attachments/upload/"', html)
