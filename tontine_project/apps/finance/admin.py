from django.contrib import admin
from apps.finance.models import Contribution, Loan, LoanRepayment, TreasuryAccount, Transaction

@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display = ['session', 'membership', 'tontine_type', 'expected_amount', 'paid_amount', 'status']
    list_filter = ['association', 'status']

@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ['membership', 'amount', 'total_due', 'total_repaid', 'status']
    list_filter = ['association', 'status']

@admin.register(LoanRepayment)
class LoanRepaymentAdmin(admin.ModelAdmin):
    list_display = ['loan', 'amount', 'paid_at']

@admin.register(TreasuryAccount)
class TreasuryAccountAdmin(admin.ModelAdmin):
    list_display = ['name', 'association', 'account_type', 'balance', 'is_active']

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['account', 'transaction_type', 'amount', 'is_debit', 'balance_after', 'created_at']
    list_filter = ['association', 'transaction_type', 'is_debit']
