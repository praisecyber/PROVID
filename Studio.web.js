import React from 'react';
import html from './generated/studio';
export default function Studio() {
  return <iframe title="PROVID movie workspace" srcDoc={html} style={{ border: 0, width: '100%', height: '100%', background: '#07140d' }} allow="clipboard-write; autoplay; fullscreen" />;
}
