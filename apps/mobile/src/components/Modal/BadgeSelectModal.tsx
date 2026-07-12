import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Badge, BadgeCategory, BadgeTier, getBadgeText } from '@vinyla/core-api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale, TranslationKey } from '@vinyla/i18n';

interface ExtendedBadge extends Badge {
  isEarned: boolean;
}

interface BadgeSelectModalProps {
  visible: boolean;
  onClose: () => void;
  badges: ExtendedBadge[];
  onSelect: (badge: ExtendedBadge) => void;
}

const CATEGORIES: { id: BadgeCategory | 'all', labelKey: TranslationKey }[] = [
  { id: 'all', labelKey: 'badgeSelect.categoryAll' },
  { id: 'collection', labelKey: 'badgeSelect.categoryCollection' },
  { id: 'wealth', labelKey: 'mobile.badgeSelect.categoryWealth' },
  { id: 'wishlist', labelKey: 'badgeSelect.categoryWishlist' },
  { id: 'genre', labelKey: 'mobile.badgeSelect.categoryGenre' },
];

function getTierColor(tier: BadgeTier): string {
  switch (tier) {
    case 'bronze': return '#cd7f32';
    case 'silver': return '#c0c0c0';
    case 'gold': return '#d4af37';
    case 'platinum': return '#e5e4e2';
    case 'diamond': return '#b9f2ff';
    default: return '#fff';
  }
}

export const BadgeSelectModal: React.FC<BadgeSelectModalProps> = ({ visible, onClose, badges, onSelect }) => {
  const { glassIntensity } = useTheme();
  const { locale, t } = useLocale();
  const [activeTab, setActiveTab] = useState<BadgeCategory | 'all'>('all');

  const filteredBadges = badges.filter(b => activeTab === 'all' || b.category === activeTab);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backgroundTouch} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={glassIntensity || 30} tint="dark" style={styles.bottomSheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('badgeSelect.title')}</Text>

          <View style={styles.tabBarWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.tabBtn, activeTab === cat.id && styles.activeTabBtn]}
                  onPress={() => setActiveTab(cat.id)}
                >
                  <Text style={[styles.tabText, activeTab === cat.id && styles.activeTabText]}>
                    {t(cat.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.badgeContainer}>
            {filteredBadges.filter(b => b.isEarned || !b.isHidden).map((badge) => {
              const tierColor = getTierColor(badge.tier);
              const badgeText = getBadgeText(badge, locale, t);
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[styles.badgeItem, !badge.isEarned && styles.unearnedBadge]}
                  onPress={() => badge.isEarned && onSelect(badge)}
                  disabled={!badge.isEarned}
                >
                  <View style={[styles.badgeIconPlaceholder, badge.isEarned && { backgroundColor: `${tierColor}1A` }]}>
                    {badge.isEarned ? (
                      <FontAwesome5 name={badge.icon === 'diamond' ? 'gem' : 'medal'} size={24} color={tierColor} />
                    ) : (
                      <Text style={styles.unearnedText}>?</Text>
                    )}
                  </View>
                  <Text style={styles.badgeName}>
                    {badge.isEarned ? badgeText.name : t('mobile.badgeSelect.notEarned')}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>
                    {badgeText.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backgroundTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    height: '65%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(25, 25, 25, 0.6)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Bodoni',
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  tabBarWrapper: {
    marginBottom: 16,
  },
  tabBar: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeTabBtn: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  tabText: {
    fontFamily: 'Pretendard',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#121212',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  badgeItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 20,
  },
  unearnedBadge: {
    opacity: 0.5,
  },
  badgeIconPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  unearnedText: {
    fontFamily: 'Pretendard',
    fontSize: 24,
    color: '#fff',
  },
  badgeName: {
    fontFamily: 'Pretendard',
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  badgeDesc: {
    fontFamily: 'Pretendard',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 4,
  },
});
