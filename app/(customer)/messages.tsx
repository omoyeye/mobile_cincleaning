import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/config';
import { ScreenHeader, TopBar } from '../../components/ClientKit';
import { ChatThreadList } from '../../components/ChatThreads';

/** Messages tab: chats with your cleaner for each booking. */
export default function CustomerMessagesTab() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ChatThreadList
        header={
          <>
            <TopBar />
            <ScreenHeader title="Messages" subtitle="Chat with your cleaner about each booking" />
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
});
