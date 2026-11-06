import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import html from './generated/studio';

export default function Studio() {
  const [error, setError] = useState('');
  if (error) return <View style={styles.error}><Text style={styles.text}>Unable to open the movie workspace. {error}</Text></View>;
  return <WebView
    source={{ html, baseUrl: 'https://provid.local/' }}
    style={styles.webview}
    originWhitelist={['https://provid.local']}
    javaScriptEnabled
    mixedContentMode="always"
    domStorageEnabled
    allowsInlineMediaPlayback
    mediaPlaybackRequiresUserAction={false}
    startInLoadingState
    renderLoading={() => <View style={styles.loadingScreen}><Image source={require('./assets/logo-mark.png')} style={styles.logo} /><Text style={styles.brand}>PROVID</Text><ActivityIndicator color="#ffd60a" style={styles.spinner} /></View>}
    onError={({ nativeEvent }) => setError(nativeEvent.description)}
    onShouldStartLoadWithRequest={request => {
      if (request.url === 'about:blank' || request.url.startsWith('https://provid.local/')) return true;
      if (request.url.startsWith('https://manymotions.com/')) Linking.openURL(request.url).catch(() => setError('Could not open ManyMotions.'));
      return false;
    }}
  />;
}
const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#07140d' },
  loadingScreen: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07140d' },
  logo: { width: 112, height: 112 },
  brand: { color: '#f4f8ee', fontSize: 22, fontWeight: '800', letterSpacing: 6, marginTop: 14 },
  spinner: { marginTop: 22 },
  error: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#07140d' },
  text: { color: '#f4f8ee' },
});
