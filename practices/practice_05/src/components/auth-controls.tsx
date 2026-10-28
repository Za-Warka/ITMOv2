"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import s from "./atlas.module.css";

type Session = {
  authenticated: boolean;
  user: { name: string; avatarUrl?: string; githubLogin?: string } | null;
};

export function AuthControls() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then(setSession)
      .catch(() => setSession({ authenticated: false, user: null }));
  }, []);

  if (!session?.authenticated || !session.user) {
    return (
      <a className={s.authLink} href="/auth/github">
        Войти через GitHub
      </a>
    );
  }

  return (
    <span className={s.authControls}>
      <Link href="/account" className={s.accountLink}>
        {session.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.avatarUrl} alt="" width={28} height={28} />
        ) : null}
        {session.user.name}
      </Link>
      <button
        type="button"
        className={s.logoutButton}
        onClick={async () => {
          await fetch("/auth/logout", { method: "POST" });
          setSession({ authenticated: false, user: null });
        }}
      >
        Выйти
      </button>
    </span>
  );
}
