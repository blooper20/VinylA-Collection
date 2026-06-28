import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { getUserVinyls, mapToFrontendModel, supabase } from '@vinyla/core-api';
import { EmptyState } from '../components/EmptyState';
import { useNavigation, NavigationProp } from '@react-navigation/native';

export const WishScreen = () => {
  const { themeColors } = useTheme();
  const [wishes, setWishes] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation<NavigationProp<any>>();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const userVinyls = await getUserVinyls(1);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        setWishes(mapped.filter(a => a.STATUS === 'WISH'));
      } else {
        setWishes([]);
      }
      setIsLoading(false);
    }
    loadData();

    const subscription = supabase
      .channel('public:USER_VINYL:mobile_wish')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, payload => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const holyGrail = wishes[0];
  const list = wishes.slice(1);
  
  const [noteVisible, setNoteVisible] = useState(false);
  const [note, setNote] = useState('');

  const renderHeader = () => {
    if (!holyGrail) return null;
    return (
      <View style={styles.spotlightContainer}>
        <Text style={[styles.spotlightLabel, { color: themeColors.accent }]}>★ Holy Grail</Text>
        <Image source={{ uri: holyGrail.IMAGE_URL }} style={styles.spotlightCover} />
        <Text style={[styles.spotlightTitle, { color: themeColors.textPrimary }]}>{holyGrail.TITLE}</Text>
        <Text style={[styles.spotlightArtist, { color: themeColors.textSecondary }]}>{holyGrail.ARTIST}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Master List</Text>
      
      {!isLoading && wishes.length === 0 ? (
        <EmptyState 
          title="위시리스트가 비어 있습니다"
          description="갖고 싶은 앨범을 검색하여 위시리스트에 추가해보세요."
          buttonText="앨범 검색하기"
          onPressAction={() => navigation.navigate('Search')}
        />
      ) : (
        <FlatList
          ListHeaderComponent={renderHeader}
          data={list}
          keyExtractor={item => item.ALBUM_ID.toString()}
          renderItem={({ item }) => (
            <View style={[styles.listItem, { borderBottomColor: themeColors.border }]}>
              <Image source={{ uri: item.IMAGE_URL }} style={styles.listCover} />
              <View style={styles.listInfo}>
                <Text style={[styles.listTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{item.TITLE}</Text>
                <Text style={[styles.listArtist, { color: themeColors.textSecondary }]}>{item.ARTIST}</Text>
                <View style={[styles.priorityBar, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <View style={[styles.priorityFill, { backgroundColor: themeColors.accent, width: `${Math.floor(Math.random() * 60) + 40}%` }]} />
                </View>
              </View>
              <TouchableOpacity style={styles.deleteBtn}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 24 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* FAB for Note - only show if there are wishes */}
      {!isLoading && wishes.length > 0 && (
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: themeColors.accent }]}
          onPress={() => setNoteVisible(true)}
        >
          <Text style={styles.fabText}>📝</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Sheet Modal for Note */}
      <Modal visible={noteVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalBg} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setNoteVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: themeColors.background, borderTopColor: themeColors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Curator's Note</Text>
              <TouchableOpacity onPress={() => setNoteVisible(false)}>
                <Text style={{ color: themeColors.accent, fontWeight: 'bold' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.noteInput, { color: themeColors.textPrimary }]}
              multiline
              autoFocus
              placeholder="Strategy, prices, condition..."
              placeholderTextColor={themeColors.textSecondary}
              value={note}
              onChangeText={setNote}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  spotlightContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  spotlightLabel: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  spotlightCover: {
    width: 240,
    height: 240,
    borderRadius: 12,
    marginBottom: 16,
  },
  spotlightTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  spotlightArtist: {
    fontSize: 16,
  },
  listItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  listCover: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 16,
  },
  listInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  listArtist: {
    fontSize: 14,
    marginBottom: 8,
  },
  priorityBar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  priorityFill: {
    height: '100%',
    borderRadius: 3,
  },
  deleteBtn: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    height: 300,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  noteInput: {
    flex: 1,
    fontSize: 16,
    textAlignVertical: 'top',
  }
});
