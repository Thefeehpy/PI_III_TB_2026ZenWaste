from rest_framework import serializers


class AdSuggestionInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, required=False, allow_blank=True)
    type = serializers.CharField(max_length=80)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, required=False, min_value=0)
    unit = serializers.CharField(max_length=20, required=False, default="kg")
    location = serializers.CharField(max_length=180, required=False, allow_blank=True)


class FreightRecommendationInputSerializer(serializers.Serializer):
    material = serializers.CharField(max_length=100)
    origin = serializers.CharField(max_length=180, required=False, allow_blank=True)
    destination = serializers.CharField(max_length=180, required=False, allow_blank=True)
    distanceKm = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    weightTon = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=0, required=False, default=0)
    cubicMeters = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=0, required=False, default=0)
