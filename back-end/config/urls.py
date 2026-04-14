from django.contrib import admin
from django.urls import include, path

from apps.common.views import api_root


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api_root, name="api-root"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/marketplace/", include("apps.marketplace.urls")),
    path("api/market/", include("apps.market.urls")),
]
