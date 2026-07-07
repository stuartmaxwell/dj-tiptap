"""dj-tiptap configuration.

Every setting is optional in the host project: these functions return the
project's DJ_TIPTAP_* value when set, or the package default otherwise.

Functions rather than module-level constants so the settings are read lazily
(at request/render time): override_settings keeps working in tests, and the
module can be imported during app loading before settings are configured.
"""

from django.conf import settings
from django.shortcuts import resolve_url

# Pillow format name -> mime type. Keys validate what Pillow detected in the
# upload view; values are stored as Attachment.content_type and forwarded to
# the editor JS (file picker + drag-drop filter) via the widget's data-accept
# attribute. No SVG: it can carry scripts, making it an XSS vector.
DEFAULT_ALLOWED_IMAGE_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "GIF": "image/gif",
    "WEBP": "image/webp",
}


def max_upload_size_mb() -> int:
    """Maximum attachment upload size in megabytes.

    Returns:
        The maximum upload size in megabytes, as configured via DJ_TIPTAP_MAX_UPLOAD_SIZE_MB.
    """
    return getattr(settings, "DJ_TIPTAP_MAX_UPLOAD_SIZE_MB", 10)


def allowed_image_types() -> dict[str, str]:
    """Mapping of accepted Pillow image formats to their mime types.

    Returns:
        The allowed image types, as configured via DJ_TIPTAP_ALLOWED_IMAGE_TYPES.
    """
    return getattr(settings, "DJ_TIPTAP_ALLOWED_IMAGE_TYPES", DEFAULT_ALLOWED_IMAGE_TYPES)


def upload_url(override: str | None = None) -> str:
    """URL of the attachment upload endpoint.

    Priority: explicit widget argument, DJ_TIPTAP_UPLOAD_URL setting, the
    built-in view. Values may be a URL name or a path (LOGIN_URL semantics);
    a replacement view just has to keep the JSON contract:
    POST multipart {file} -> 201 {url, alt?, ...} or 4xx {error}.

    Args:
        override: Optional URL override for the upload endpoint.

    Returns:
        The upload URL, as configured via DJ_TIPTAP_UPLOAD_URL or the default view.
    """
    return resolve_url(override or getattr(settings, "DJ_TIPTAP_UPLOAD_URL", "website:attachment_upload"))


def browse_url(override: str | None = None) -> str:
    """URL of the media-library browse endpoint.

    Same priority and name-or-path semantics as upload_url. A replacement
    view returns an HTML fragment honouring the picker's data attributes:
    data-image-url/data-image-alt (insert), data-fetch (load another page),
    data-close (dismiss).

    Args:
        override: Optional URL override for the browse endpoint.

    Returns:
        The browse URL, as configured via DJ_TIPTAP_BROWSE_URL or the default view.
    """
    return resolve_url(override or getattr(settings, "DJ_TIPTAP_BROWSE_URL", "website:attachment_browse"))
