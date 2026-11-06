import React from 'react';
import { Platform, StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Studio from './Studio';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#07140d" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.workspace}><Studio /></View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07140d', ...(Platform.OS === 'web' ? { height: '100vh' } : {}) },
  workspace: { flex: 1 },
});
