import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Badge } from '@vinyla/core-api';
import { FontAwesome5 } from '@expo/vector-icons';

interface ExtendedBadge extends Badge {
  isEarned: boolean;
}

interface BadgeSelectModalProps {
  visible: boolean;
  onClose: () => void;
  badges: ExtendedBadge[];
  onSelect: (badge: ExtendedBadge) => void;
}

export const BadgeSelectModal: React.FC<BadgeSelectModalProps> = ({ visible, onClose, badges, onSelect }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backgroundTouch} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={80} tint="dark" style={styles.bottomSheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>칭호 선택</Text>
          <ScrollView contentContainerStyle={styles.badgeContainer}>
            {badges.filter(b => b.isEarned || !b.isHidden).map((badge) => (
              <TouchableOpacity
                key={badge.id}
                style={[styles.badgeItem, !badge.isEarned && styles.unearnedBadge]}
                onPress={() => badge.isEarned && onSelect(badge)}
                disabled={!badge.isEarned}
              >
                <View style={styles.badgeIconPlaceholder}>
                  {badge.isEarned ? (
                    <FontAwesome5 name="gem" size={24} color="#d4af37" />
                  ) : (
                    <Text style={styles.unearnedText}>?</Text>
                  )}
                </View>
                <Text style={styles.badgeName}>
                  {badge.isEarned ? badge.name : '미획득'}
                </Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>
                  {badge.isEarned ? badge.description : badge.description}
                </Text>
              </TouchableOpacity>
            ))}
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
    height: '60%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
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
    marginBottom: 20,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    width: 80,
    height: 80,
    borderRadius: 40,
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
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  badgeDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 4,
  },
});
