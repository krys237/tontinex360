from django.contrib import admin
from apps.members.models import Membership, Role, MemberRole, BureauPosition, BureauMember


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'association', 'member_number', 'status', 'is_active']
    list_filter = ['status', 'is_active', 'association']
    search_fields = ['user__first_name', 'user__last_name', 'user__telephone']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'association', 'is_bureau_role', 'is_system', 'hierarchy_level']
    list_filter = ['association', 'is_bureau_role', 'is_system']


@admin.register(MemberRole)
class MemberRoleAdmin(admin.ModelAdmin):
    list_display = ['membership', 'role', 'is_active']
    list_filter = ['association', 'is_active']


@admin.register(BureauPosition)
class BureauPositionAdmin(admin.ModelAdmin):
    list_display = ['name', 'association', 'display_order', 'is_required']
    list_filter = ['association']


@admin.register(BureauMember)
class BureauMemberAdmin(admin.ModelAdmin):
    list_display = ['membership', 'position', 'cycle', 'is_active', 'designation_method']
    list_filter = ['association', 'is_active']
