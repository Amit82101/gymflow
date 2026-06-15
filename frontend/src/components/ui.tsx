import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/src/theme";

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: "rgba(16,185,129,0.12)", color: colors.success, label: "ACTIVE" },
    expiring: { bg: "rgba(245,158,11,0.12)", color: colors.warning, label: "EXPIRING" },
    expired: { bg: "rgba(239,68,68,0.12)", color: colors.error, label: "EXPIRED" },
    paid: { bg: "rgba(16,185,129,0.12)", color: colors.success, label: "PAID" },
    pending: { bg: "rgba(245,158,11,0.12)", color: colors.warning, label: "PENDING" },
  };
  const s = map[status] || { bg: colors.surface2, color: colors.textSecondary, label: status.toUpperCase() };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.color + "33" }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <Text onPress={onAction} style={styles.sectionAction}>
          {action}
        </Text>
      )}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySub}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionAction: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  empty: { alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  emptyTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: spacing.md },
  emptySub: { color: colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: "center" },
});
