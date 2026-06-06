from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from apps.core.models import User, Association


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['telephone', 'first_name', 'last_name', 'email', 'is_active']
    search_fields = ['telephone', 'first_name', 'last_name', 'email']
    ordering = ['-created_at']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Extra', {'fields': ('telephone', 'avatar', 'language')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Extra', {'fields': ('telephone', 'first_name', 'last_name')}),
    )


@admin.register(Association)
class AssociationAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'city', 'is_active', 'created_at']
    search_fields = ['name', 'slug', 'city']
    list_filter = ['is_active', 'country']
    prepopulated_fields = {'slug': ('name',)}
