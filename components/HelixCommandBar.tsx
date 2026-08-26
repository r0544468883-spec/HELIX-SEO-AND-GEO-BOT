'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommandPalette, type CommandItem } from '@/lib/motion';
import '@/lib/motion/tokens.css';

// HELIX Rank product accent — amber.
const ACCENT = '#F59E0B';

export default function HelixCommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const nav = (path: string) => () => router.push(path);

  const items: CommandItem[] = [
    { id: 'home', title: 'GSC Intelligence', subtitle: 'Striking Distance', keywords: 'gsc search console home בית', run: nav('/') },
    { id: 'geo', title: 'GEO Monitor', subtitle: 'ניטור GEO', keywords: 'geo brand ai visibility', run: nav('/geo') },
    { id: 'launch', title: 'בדיקת תקינות', subtitle: 'Launch readiness', keywords: 'launch health בדיקה תקינות', run: nav('/launch') },
    { id: 'write', title: 'כתיבה ופרסום', subtitle: 'Write & publish', keywords: 'write content כתיבה פרסום', run: nav('/write') },
    { id: 'sites', title: 'האתרים שלי', subtitle: 'My sites', keywords: 'sites אתרים', run: nav('/sites') },
    { id: 'templates', title: 'תבניות', subtitle: 'Templates', keywords: 'templates תבניות', run: nav('/templates') },
    { id: 'autonomy', title: 'אוטונומיה', subtitle: 'Autonomy', keywords: 'autonomy אוטונומיה switch', run: nav('/autonomy') },
    { id: 'login', title: 'התחברות', subtitle: 'Login', keywords: 'login התחברות', run: nav('/login') },
  ];

  return (
    <div dir="rtl" style={{ ['--hm-accent' as any]: ACCENT }}>
      <CommandPalette
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        items={items}
        hotkey
        placeholder="חיפוש פקודות ומסכים…"
      />
    </div>
  );
}
