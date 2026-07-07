"""Post model."""

from pathlib import Path

from django.db import models
from django.utils import timezone


class Post(models.Model):
    """Post model."""

    title = models.CharField(max_length=200)
    content = models.TextField()
    published_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        """Meta options for the Post model."""

        ordering = ["-updated_at"]
        verbose_name = "post"
        verbose_name_plural = "posts"

    def __str__(self) -> str:
        """Return the string representation of the post."""
        return f"{self.id}: {self.title}"


class Attachment(models.Model):
    """Attachment model."""

    file = models.FileField(upload_to="attachments/%Y/%m/")
    # Storage suffixes the stored name on collision, so keep the original.
    original_filename = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    file_size = models.PositiveIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Meta options for the Attachment model."""

        ordering = ["-uploaded_at"]
        verbose_name = "attachment"
        verbose_name_plural = "attachments"

    def __str__(self) -> str:
        """Return the string representation of the attachment."""
        return f"{self.id}: {self.title or self.original_filename}"

    @property
    def alt_text(self) -> str:
        """Alt text for inserted images: the title, or the filename stem as a fallback."""
        return self.title or Path(self.original_filename).stem
