"""Admnin configuration."""

from django.contrib import admin

from website import models


# Register your models here.
@admin.register(models.Post)
class PostAdmin(admin.ModelAdmin):
    """Post admin configuration."""

    list_display = ["id", "title", "published_at", "updated_at"]
    search_fields = ["title", "content"]


@admin.register(models.Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    """Attachment admin configuration."""

    list_display = ["id", "original_filename", "title", "content_type", "file_size", "uploaded_at"]
    search_fields = ["original_filename", "title"]
