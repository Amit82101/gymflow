import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";

export default function Attendance() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [att, mem] = await Promise.all([api.todayAttendance(), api.listMembers()]);
      setRecords(att);
      setAllMembers(mem);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const checkInMember = async (memberId: string) => {
    setBusyId(memberId);
    try {
      await api.checkIn(memberId);
      await load();
      setModal(false);
      setSearch("");
    } catch (e: any) {
      Alert.alert("Check-in failed", e.message);
    } finally {
      setBusyId(null);
    }
  };

  const checkOut = async (memberId: string) => {
    setBusyId(memberId);
    try {
      await api.checkOut(memberId);
      await load();
    } catch (e: any) {
      Alert.alert("Check-out failed", e.message);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = allMembers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) || (m.phone || "").includes(search),
  );

  const totalIn = records.length;
  const stillIn = records.filter((r) => !r.check_out_time).length;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ATTENDANCE</Text>
          <Text style={styles.sub}>Today · {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            testID="scan-qr-btn"
            style={[styles.addBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }]}
            onPress={() => router.push("/scanner")}
          >
            <Ionicons name="qr-code" size={18} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>SCAN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="open-checkin-btn"
            style={styles.addBtn}
            onPress={() => setModal(true)}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addBtnText}>MANUAL</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statCard, { borderColor: colors.success + "33" }]}>
          <Text style={[styles.statVal, { color: colors.success }]} testID="att-total">{totalIn}</Text>
          <Text style={styles.statLbl}>TOTAL TODAY</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.primary + "33" }]}>
          <Text style={[styles.statVal, { color: colors.primary }]} testID="att-still-in">{stillIn}</Text>
          <Text style={styles.statLbl}>STILL IN GYM</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const ci = new Date(item.check_in_time);
            const co = item.check_out_time ? new Date(item.check_out_time) : null;
            return (
              <View style={styles.row} testID={`att-row-${item.id}`}>
                <View style={[styles.dot, { backgroundColor: co ? colors.textMuted : colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.member_name}</Text>
                  <Text style={styles.rowTime}>
                    IN {ci.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    {co ? ` · OUT ${co.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </Text>
                </View>
                {!co ? (
                  <TouchableOpacity
                    testID={`checkout-${item.member_id}`}
                    style={styles.outBtn}
                    onPress={() => checkOut(item.member_id)}
                    disabled={busyId === item.member_id}
                  >
                    {busyId === item.member_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.outBtnText}>CHECK OUT</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.doneBadge}>
                    <Ionicons name="checkmark" size={14} color={colors.success} />
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="time-outline" size={48} color={colors.textMuted} />}
              title="No check-ins yet today"
              subtitle="Tap CHECK-IN to log a member's entry"
            />
          }
        />
      )}

      {/* Modal: pick a member */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CHECK-IN MEMBER</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                testID="checkin-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search member..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoFocus
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(m) => m.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`pick-${item.id}`}
                  style={styles.pickRow}
                  onPress={() => checkInMember(item.id)}
                  disabled={busyId === item.id}
                >
                  <View style={styles.pickAvatar}>
                    {item.photo ? (
                      <Image source={{ uri: item.photo }} style={styles.pickAvatarImg} />
                    ) : (
                      <Text style={styles.pickAvatarText}>{item.name[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{item.name}</Text>
                    <Text style={styles.pickMeta}>{item.phone}</Text>
                  </View>
                  {busyId === item.id ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons name="arrow-forward-circle" size={26} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: "center", color: colors.textMuted, padding: 24 }}>
                  No members found
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 1.5 },
  statRow: { flexDirection: "row", gap: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  statVal: { fontSize: 32, fontWeight: "900" },
  statLbl: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  rowTime: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  outBtn: {
    paddingHorizontal: 12,
    height: 32,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  outBtnText: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  doneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.surface,
    height: "80%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1.5 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pickAvatarImg: { width: 40, height: 40 },
  pickAvatarText: { color: colors.primary, fontWeight: "900", fontSize: 16 },
  pickName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pickMeta: { color: colors.textSecondary, fontSize: 12 },
});
