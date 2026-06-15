import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { StatusBadge, EmptyState } from "@/src/components/ui";

const FILTERS = [
  { id: "", label: "ALL" },
  { id: "active", label: "ACTIVE" },
  { id: "expiring", label: "EXPIRING" },
  { id: "expired", label: "EXPIRED" },
];

export default function Members() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listMembers(search || undefined, filter || undefined);
      setMembers(data);
    } catch (e) {
      console.warn(e);
    }
  }, [search, filter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, filter, load]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>MEMBERS</Text>
        <TouchableOpacity
          testID="add-member-btn"
          style={styles.addBtn}
          onPress={() => router.push("/member/new")}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="member-search-input"
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, email..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id || "all"}
              testID={`filter-${f.id || "all"}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => <MemberRow member={item} onPress={() => router.push(`/member/${item.id}`)} />}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="people-outline" size={48} color={colors.textMuted} />}
              title="No members yet"
              subtitle="Tap + to add your first gym member"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function MemberRow({ member, onPress }: { member: any; onPress: () => void }) {
  const initial = (member.name?.[0] || "?").toUpperCase();
  return (
    <TouchableOpacity
      testID={`member-row-${member.id}`}
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        {member.photo ? (
          <Image source={{ uri: member.photo }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{initial}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{member.name}</Text>
        <Text style={styles.meta}>
          {(member.plan || "monthly").toUpperCase()} · {member.phone}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <StatusBadge status={member.status} />
        {typeof member.days_left === "number" && (
          <Text style={styles.daysLeft}>
            {member.days_left < 0 ? `${-member.days_left}d overdue` : `${member.days_left}d left`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginVertical: spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  chipTextActive: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 48, height: 48 },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: "900" },
  name: { color: "#fff", fontSize: 15, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2, letterSpacing: 0.3 },
  daysLeft: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
});
