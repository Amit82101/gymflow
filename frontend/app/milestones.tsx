import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { EmptyState } from "@/src/components/ui";

type Milestone = {
  member_id: string;
  name: string;
  phone?: string;
  photo?: string;
  days_until: number;
  date: string;
  age_turning?: number;
  years?: number;
};

const GYM_NAME = "GymFlow";

function buildBirthdayMessage(m: Milestone) {
  const todayMsg =
    `🎂 Happy Birthday, ${m.name}!\n\n` +
    `Wishing you an amazing year ahead from all of us at ${GYM_NAME} 💪\n` +
    `As a small gift, drop by today and ask us about your birthday surprise.\n\n` +
    `Stay strong, stay healthy! 🎉`;
  const upcomingMsg =
    `🎂 Hey ${m.name}! Just a heads-up — your birthday is in ${m.days_until} day${m.days_until === 1 ? "" : "s"}!\n\n` +
    `From all of us at ${GYM_NAME}, we'd love to celebrate with you. Drop by on your special day for a little surprise 🎁\n\n` +
    `Lots of love & gains 💪`;
  return m.days_until === 0 ? todayMsg : upcomingMsg;
}

function buildAnniversaryMessage(m: Milestone) {
  const y = m.years || 1;
  const yLabel = y === 1 ? "1 year" : `${y} years`;
  if (m.days_until === 0) {
    return (
      `🏆 Today marks ${yLabel} since you joined ${GYM_NAME}, ${m.name}!\n\n` +
      `We're proud of your journey and consistency 💪\n` +
      `Thank you for trusting us — here's to many more PRs and milestones together.\n\n` +
      `Drop by today and let's celebrate 🎉`
    );
  }
  return (
    `🏆 Hey ${m.name} — in ${m.days_until} day${m.days_until === 1 ? "" : "s"} you'll complete ${yLabel} with ${GYM_NAME}!\n\n` +
    `We're proud of how far you've come. Thanks for being part of our community 💪\n\n` +
    `Wishing you many more gains ahead!`
  );
}

async function openWhatsApp(phone: string | undefined, message: string) {
  const raw = (phone || "").replace(/[^\d+]/g, "");
  const num = raw.startsWith("+") ? raw.slice(1) : raw;
  if (!num) {
    Alert.alert("No phone number", "This member doesn't have a phone number on file.");
    return;
  }
  const appUrl = `whatsapp://send?phone=${num}&text=${encodeURIComponent(message)}`;
  const webUrl = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
  try {
    const ok = await Linking.canOpenURL(appUrl);
    await Linking.openURL(ok ? appUrl : webUrl);
  } catch {
    try {
      await Linking.openURL(webUrl);
    } catch (e: any) {
      Alert.alert("Failed to open WhatsApp", e.message);
    }
  }
}

export default function Milestones() {
  const router = useRouter();
  const [data, setData] = useState<{ birthdays: Milestone[]; anniversaries: Milestone[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.milestones(7);
      setData(d);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const totalToday =
    (data?.birthdays.filter((b) => b.days_until === 0).length || 0) +
    (data?.anniversaries.filter((a) => a.days_until === 0).length || 0);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="milestones-back">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>MILESTONES</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
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
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>NEXT 7 DAYS</Text>
          <Text style={styles.heroTitle}>
            {totalToday > 0 ? `${totalToday} to celebrate today 🎉` : "Reach out & make their day"}
          </Text>
          <Text style={styles.heroSub}>
            Tap any name to send a personal WhatsApp wish — pre-filled and ready to go.
          </Text>
        </View>

        <Text style={styles.section}>🎂 BIRTHDAYS</Text>
        {!data?.birthdays.length ? (
          <EmptyState
            icon={<Ionicons name="gift-outline" size={40} color={colors.textMuted} />}
            title="No upcoming birthdays"
            subtitle="Add birth dates on member profiles to see them here"
          />
        ) : (
          data.birthdays.map((m) => (
            <MilestoneRow
              key={`b-${m.member_id}`}
              testID={`birthday-${m.member_id}`}
              member={m}
              icon="gift"
              accent={colors.primary}
              label={m.days_until === 0 ? "TODAY 🎉" : `IN ${m.days_until}D`}
              detail={m.age_turning ? `Turning ${m.age_turning}` : ""}
              onSend={() => openWhatsApp(m.phone, buildBirthdayMessage(m))}
              onPress={() => router.push(`/member/${m.member_id}`)}
            />
          ))
        )}

        <Text style={[styles.section, { marginTop: spacing.xl }]}>🏆 MEMBERSHIP ANNIVERSARIES</Text>
        {!data?.anniversaries.length ? (
          <EmptyState
            icon={<Ionicons name="trophy-outline" size={40} color={colors.textMuted} />}
            title="No upcoming anniversaries"
            subtitle="Members joined this past year don't appear here yet"
          />
        ) : (
          data.anniversaries.map((m) => (
            <MilestoneRow
              key={`a-${m.member_id}`}
              testID={`anniv-${m.member_id}`}
              member={m}
              icon="trophy"
              accent={colors.warning}
              label={m.days_until === 0 ? "TODAY 🎉" : `IN ${m.days_until}D`}
              detail={`${m.years}-year member`}
              onSend={() => openWhatsApp(m.phone, buildAnniversaryMessage(m))}
              onPress={() => router.push(`/member/${m.member_id}`)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MilestoneRow({
  member,
  icon,
  accent,
  label,
  detail,
  onSend,
  onPress,
  testID,
}: {
  member: Milestone;
  icon: any;
  accent: string;
  label: string;
  detail: string;
  onSend: () => void;
  onPress: () => void;
  testID: string;
}) {
  const initial = member.name?.[0]?.toUpperCase() || "?";
  return (
    <View style={styles.row} testID={testID}>
      <TouchableOpacity style={styles.rowMain} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.avatar, { borderColor: accent + "55" }]}>
          {member.photo ? (
            <Image source={{ uri: member.photo }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarText, { color: accent }]}>{initial}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={icon} size={14} color={accent} />
            <Text style={styles.name}>{member.name}</Text>
          </View>
          <Text style={styles.meta}>
            {detail} · {member.phone || "—"}
          </Text>
        </View>
        <View style={[styles.badge, { borderColor: accent + "55", backgroundColor: accent + "1A" }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{label}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity testID={`${testID}-send`} style={styles.sendBtn} onPress={onSend}>
        <Ionicons name="logo-whatsapp" size={16} color="#fff" />
        <Text style={styles.sendText}>SEND WISH</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  heroEyebrow: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 6, lineHeight: 28 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
  section: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 2, marginBottom: spacing.md },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.lg },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center",
    borderWidth: 2, overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44 },
  avatarText: { fontSize: 18, fontWeight: "900" },
  name: { color: "#fff", fontSize: 15, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  sendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 42, backgroundColor: "#25D366",
  },
  sendText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
});
