import React, { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
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
    domStorageEnabled
    allowsInlineMediaPlayback
    mediaPlaybackRequiresUserAction={false}
    startInLoadingState
    renderLoading={() => <ActivityIndicator color="#f1c17c" style={styles.loading} />}
    onError={({ nativeEvent }) => setError(nativeEvent.description)}
    onShouldStartLoadWithRequest={request => {
      if (request.url === 'about:blank' || request.url.startsWith('https://provid.local/')) return true;
      if (request.url.startsWith('https://manymotions.com/')) Linking.openURL(request.url).catch(() => setError('Could not open ManyMotions.'));
      return false;
    }}
  />;
}
const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#0c0e13' },
  loading: { position: 'absolute', top: '50%', left: '50%' },
  error: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0c0e13' },
  text: { color: '#f7f3ed' },
});
