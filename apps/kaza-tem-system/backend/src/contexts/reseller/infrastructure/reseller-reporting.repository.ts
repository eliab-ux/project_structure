import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { AdminResellerRow } from '../application/dto/admin-reseller.dto';

export interface ResellerAdminListingFilter {
  status?: string[];
  level?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ResellerReportingRepository {
  constructor(private readonly em: EntityManager) {}

  async list(
    filter: ResellerAdminListingFilter,
  ): Promise<{ total: number; items: AdminResellerRow[] }> {
    const { whereClause, params } = this.buildFilter(filter);
    const total = await this.fetchTotal(whereClause, params);

    const limit = filter.limit ?? 20;
    const offset = filter.offset ?? 0;
    const dataParams = [...params, limit, offset];

    const limitPlaceholder = `$${params.length + 1}`;
    const offsetPlaceholder = `$${params.length + 2}`;

    const rows = (await this.em.getConnection().execute(
      `
        SELECT
          r.id,
          r.user_id AS "userId",
          u.name AS "userName",
          u.email AS "userEmail",
          r.cpf,
          r.unique_link AS "uniqueLink",
          r.status,
          r.level,
          r.approved_at AS "approvedAt",
          r.approved_by AS "approvedBy",
          r.rejected_at AS "rejectedAt",
          r.rejected_reason AS "rejectedReason",
          r.phone,
          r.bank_name AS "bankName",
          r.bank_code AS "bankCode",
          r.bank_agency AS "bankAgency",
          r.bank_account AS "bankAccount",
          r.bank_account_type AS "bankAccountType",
          r.bank_holder_name AS "bankHolderName",
          r.bank_holder_cpf AS "bankHolderCpf",
          r.pix_key AS "pixKey",
          r.pix_key_type AS "pixKeyType",
          COALESCE(r.total_sold_year, 0) AS "totalSoldYear",
          r.suspended_at AS "suspendedAt",
          r.suspension_reason AS "suspensionReason",
          latest_subscription.status AS "subscriptionStatus",
          latest_subscription.amount AS "subscriptionAmount",
          latest_subscription.next_billing_date AS "subscriptionNextBilling",
          r.created_at AS "createdAt",
          r.updated_at AS "updatedAt"
        FROM resellers r
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN LATERAL (
          SELECT status, amount, next_billing_date
          FROM subscriptions
          WHERE reseller_id = r.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) AS latest_subscription ON true
        WHERE ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      dataParams,
    )) as Record<string, unknown>[];

    return {
      total,
      items: rows.map((row) => this.normalizeRow(row)),
    };
  }

  private async fetchTotal(whereClause: string, params: unknown[]): Promise<number> {
    const rows = await this.em.getConnection().execute(
      `
          SELECT COUNT(*) AS count
          FROM resellers r
          LEFT JOIN users u ON u.id = r.user_id
          WHERE ${whereClause}
        `,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }

  private buildFilter(filter: ResellerAdminListingFilter): {
    whereClause: string;
    params: unknown[];
  } {
    const clauses: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filter.status && Array.isArray(filter.status) && filter.status.length > 0) {
      const normalized = filter.status.map((value) => value.trim()).filter(Boolean);
      if (normalized.length > 0) {
        // Use IN clause instead of ANY for better compatibility
        const placeholders = normalized.map((_, index) => {
          return this.addParam(params, normalized[index]);
        });
        clauses.push(`r.status IN (${placeholders.join(', ')})`);
      }
    }

    if (filter.level) {
      const placeholder = this.addParam(params, filter.level.trim());
      clauses.push(`r.level = ${placeholder}`);
    }

    if (filter.search && filter.search.trim().length > 0) {
      const query = filter.search.trim();
      const wildcard = `%${query}%`;
      const namePlaceholder = this.addParam(params, wildcard.toLowerCase());
      const emailPlaceholder = this.addParam(params, wildcard.toLowerCase());
      const cpfPlaceholder = this.addParam(params, wildcard);

      clauses.push(
        `(LOWER(u.name) LIKE ${namePlaceholder} OR LOWER(u.email) LIKE ${emailPlaceholder} OR r.cpf LIKE ${cpfPlaceholder})`,
      );
    }

    return {
      whereClause: clauses.join(' AND '),
      params,
    };
  }

  private normalizeRow(row: Record<string, unknown>): AdminResellerRow {
    return {
      id: String(row.id),
      userId: String(row.userId),
      userName: row.userName ? String(row.userName) : null,
      userEmail: row.userEmail ? String(row.userEmail) : null,
      cpf: String(row.cpf),
      uniqueLink: String(row.uniqueLink),
      status: String(row.status),
      level: String(row.level),
      canSetCustomPrice: false, // Campo removido do banco, usando valor padrão
      approvedAt: this.toDate(row.approvedAt),
      approvedBy: row.approvedBy ? String(row.approvedBy) : null,
      rejectedAt: this.toDate(row.rejectedAt),
      rejectedReason: row.rejectedReason ? String(row.rejectedReason) : null,
      phone: row.phone ? String(row.phone) : null,
      bankName: row.bankName ? String(row.bankName) : null,
      bankCode: row.bankCode ? String(row.bankCode) : null,
      bankAgency: row.bankAgency ? String(row.bankAgency) : null,
      bankAccount: row.bankAccount ? String(row.bankAccount) : null,
      bankAccountType: row.bankAccountType ? String(row.bankAccountType) : null,
      bankHolderName: row.bankHolderName ? String(row.bankHolderName) : null,
      bankHolderCpf: row.bankHolderCpf ? String(row.bankHolderCpf) : null,
      pixKey: row.pixKey ? String(row.pixKey) : null,
      pixKeyType: row.pixKeyType ? String(row.pixKeyType) : null,
      totalSoldYear: Number(row.totalSoldYear ?? 0),
      suspendedAt: this.toDate(row.suspendedAt),
      suspensionReason: row.suspensionReason ? String(row.suspensionReason) : null,
      subscriptionStatus: row.subscriptionStatus ? String(row.subscriptionStatus) : null,
      subscriptionAmount:
        row.subscriptionAmount !== undefined && row.subscriptionAmount !== null
          ? Number(row.subscriptionAmount)
          : null,
      subscriptionNextBilling: this.toDate(row.subscriptionNextBilling),
      createdAt: this.toDate(row.createdAt) ?? new Date(),
      updatedAt: this.toDate(row.updatedAt) ?? new Date(),
    };
  }

  private addParam(params: unknown[], value: unknown): string {
    params.push(value);
    return `$${params.length}`;
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' && value) {
      return new Date(value);
    }
    return null;
  }
}
