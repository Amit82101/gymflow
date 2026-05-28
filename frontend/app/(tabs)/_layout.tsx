import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 1,
          textTransform: "uppercase",
        },
        tabBarStyle: {
          backgroundColor: "rgba(10,10,10,0.96)",
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            dashboard: focused ? "grid" : "grid-outline",
            members: focused ? "people" : "people-outline",
            attendance: focused ? "checkmark-done-circle" : "checkmark-done-circle-outline",
            fees: focused ? "cash" : "cash-outline",
          };
          const name = map[route.name] || "ellipse-outline";
          return (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={name} size={focused ? 26 : 22} color={color} />
              {focused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                    marginTop: 2,
                  }}
                />
              )}
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="members" options={{ title: "Members" }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
      <Tabs.Screen name="fees" options={{ title: "Fees" }} />
    </Tabs>
  );
}
