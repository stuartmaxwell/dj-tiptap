"""Forms for the DJ Press Admin interface."""

from django import forms

from dj_tiptap.widgets import DjTiptapWidget
from website import models


class PostForm(forms.ModelForm):
    """Form for creating a post - uses the DjTiptapWidget for the content field."""

    class Meta:
        """Meta class for PostForm."""

        model = models.Post
        fields = ["title", "content"]
        widgets = {"content": DjTiptapWidget()}
