from rest_framework import serializers


class SignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, min_length=8)
