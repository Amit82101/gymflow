import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";

const HERO_IMAGE = {
  uri: "https://static.prod-images.emergentagent.com/jobs/b6f57d58-421b-4d6b-9bb5-62846693bb96/images/74e29d95a1874da80f0624ec3267c0fa2bc4099536540eed6dd252fb9801a6df.png",
};

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("admin@gymflow.com");
  const [password, setPassword] = useState("admin123");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={HERO_IMAGE} style={styles.hero} resizeMode="cover">
        <LinearGradient
          colors={["rgba(10,10,10,0.4)", "rgba(10,10,10,0.85)", "#0A0A0A"]}
          style={styles.gradient}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.brandWrap}>
                <View style={styles.logoBadge}>
                  <Ionicons name="barbell" size={28} color={colors.primary} />
                </View>
                <Text style={styles.brand} testID="brand-title">
                  GYM<Text style={{ color: colors.primary }}>FLOW</Text>
                </Text>
                <Text style={styles.tagline}>ADMIN CONTROL PANEL</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.welcome}>Welcome back.</Text>
                <Text style={styles.sub}>Sign in to manage your gym.</Text>

                <Text style={styles.label}>EMAIL</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                  <TextInput
                    testID="login-email-input"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="admin@gymflow.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                  />
                </View>

                <Text style={[styles.label, { marginTop: spacing.lg }]}>PASSWORD</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                  <TextInput
                    testID="login-password-input"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPwd}
                    style={styles.input}
                  />
                  <TouchableOpacity onPress={() => setShowPwd((v) => !v)}>
                    <Ionicons
                      name={showPwd ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {error && (
                  <View style={styles.errorBox} testID="login-error">
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  testID="login-submit-button"
                  activeOpacity={0.85}
                  onPress={submit}
                  style={styles.cta}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.ctaText}>SIGN IN</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.hint}>
                  Default: admin@gymflow.com / admin123
                </Text>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  gradient: { ...StyleSheet.absoluteFillObject },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  brandWrap: { alignItems: "center", marginBottom: spacing.xxxl, marginTop: spacing.xl },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,59,48,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brand: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 4,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  welcome: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: spacing.xl },
  label: {
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  input: { flex: 1, color: "#fff", fontSize: 15 },
  cta: {
    marginTop: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 3 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },
  hint: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.lg,
  },
});
