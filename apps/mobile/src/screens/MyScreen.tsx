import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, ThemeType } from '@vinyla/ui';
import { mockVinyls } from '@vinyla/shared-types';
import { useAuthStore } from '@vinyla/core-api';

const { width } = Dimensions.get('window');

const AnalyticsCard = ({ title, value, themeColors }: { title: string, value: string, themeColors: any }) => (
  <View style={[styles.card, { borderColor: themeColors.border, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
    <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>{title}</Text>
    <Text style={[styles.cardValue, { color: themeColors.textPrimary }]}>{value}</Text>
  </View>
);

export const MyScreen = () => {
  const { theme, setTheme, themeColors } = useTheme();
  const { user } = useAuthStore();
  const navigation = useNavigation<any>();

  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
  };

  const themes: { id: ThemeType, label: string }[] = [
    { id: 'DARK_BLACK', label: 'Dark Black' },
    { id: 'MOODY_WALNUT', label: 'Moody Walnut' },
    { id: 'CLEAN_DOODLING', label: 'Clean Doodling' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Identity Section */}
      <View style={styles.heroSection}>
        <View style={[styles.avatarFrame, { borderColor: themeColors.accent }]}>
          <Image 
            source={{ uri: user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150?img=32' }} 
            style={styles.avatar} 
          />
        </View>
        <Text style={[styles.userName, { color: themeColors.textPrimary }]}>
          {user?.user_metadata?.displayName || 'Collector'}
        </Text>
        <View style={[styles.badge, { backgroundColor: themeColors.accent }]}>
          <Text style={styles.badgeText}>Elite Curator</Text>
        </View>
      </View>

      {/* Theme Switcher */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Theme</Text>
        <View style={styles.themeSwitcher}>
          {themes.map(t => (
            <TouchableOpacity 
              key={t.id} 
              style={[
                styles.themeBtn, 
                { borderColor: themeColors.border },
                theme === t.id && { backgroundColor: themeColors.accent, borderColor: themeColors.accent }
              ]}
              onPress={() => handleThemeChange(t.id)}
            >
              <Text style={[
                styles.themeBtnText, 
                { color: theme === t.id ? '#000' : themeColors.textSecondary }
              ]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutBtn, { borderColor: themeColors.border }]}
          onPress={async () => {
            try {
              const { signOut } = await import('@vinyla/core-api');
              await signOut();
              navigation.replace('Onboarding');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }}
        >
          <Text style={[styles.logoutBtnText, { color: themeColors.textPrimary }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Analytics */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Vault Analytics</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          <AnalyticsCard title="Collection Value" value="$4,250" themeColors={themeColors} />
          <AnalyticsCard title="Total Records" value="142" themeColors={themeColors} />
          <AnalyticsCard title="Top Genre" value="Jazz" themeColors={themeColors} />
        </ScrollView>
      </View>

      {/* Musical Journey (Timeline) */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Musical Journey</Text>
        <View style={styles.timeline}>
          {mockVinyls.slice(0, 3).map((album, index) => (
            <View key={album.ALBUM_ID} style={styles.timelineItem}>
              <View style={[styles.timelineLine, { backgroundColor: themeColors.border }]} />
              <View style={[styles.timelineDot, { backgroundColor: themeColors.accent }]} />
              <Image source={{ uri: album.IMAGE_URL }} style={styles.timelineImage} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{album.TITLE}</Text>
                <Text style={[styles.timelineDate, { color: themeColors.textSecondary }]}>Collected 2 days ago</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  avatarFrame: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 20,
    marginBottom: 16,
  },
  horizontalScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    width: width * 0.4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  timeline: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 20,
    bottom: -20,
    width: 2,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 32,
    marginRight: 16,
  },
  timelineImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  timelineContent: {
    justifyContent: 'center',
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
  },
  themeSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  themeBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutBtn: {
    marginTop: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,0,0,0.05)',
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  }
});
