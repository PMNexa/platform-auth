from rest_framework import serializers


class SignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    # Its rules (length, common passwords) are system settings - passwords.py.
    password = serializers.CharField(trim_whitespace=False)
    # Where the signup page was heading (its `?next=`) and who sent the
    # visitor (its `?ref=`) - see SignupView.
    next = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    ref = serializers.CharField(required=False, allow_blank=True, max_length=64)
