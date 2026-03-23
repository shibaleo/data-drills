"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useMe } from "@/components/auth/auth-gate";
import { api, ApiError } from "@/lib/api-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: Props) {
  const { me, refresh } = useMe();

  // Name editing
  const [name, setName] = useState(me.name);
  const [nameSaving, setNameSaving] = useState(false);

  // Password
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(me.name);
      setPassword("");
      setPasswordConfirm("");
    }
  }, [open, me.name]);

  const handleSaveName = async () => {
    if (!name.trim() || name === me.name) return;
    setNameSaving(true);
    try {
      await api.put(`/users/${me.id}`, { name: name.trim() });
      await refresh();
      toast.success("表示名を変更しました");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "変更に失敗しました");
    } finally { setNameSaving(false); }
  };

  const handleChangePassword = async () => {
    if (password.length < 4) {
      toast.error("パスワードは4文字以上にしてください");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("パスワードが一致しません");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post(`/users/${me.id}/password`, { password });
      setPassword("");
      setPasswordConfirm("");
      toast.success("パスワードを変更しました");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.body.error : "変更に失敗しました");
    } finally { setPasswordSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ユーザー設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ── Profile ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">プロフィール</h3>
            <div className="space-y-1">
              <Label>メールアドレス</Label>
              <p className="text-sm text-muted-foreground">{me.email}</p>
            </div>
          </section>

          {/* ── Display Name ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">表示名</h3>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={nameSaving || !name.trim() || name === me.name}
              >
                {nameSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </section>

          {/* ── Password ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">パスワード変更</h3>
            <div className="space-y-2">
              <Label htmlFor="settings-pw">新しいパスワード</Label>
              <Input
                id="settings-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-pw-confirm">確認</Label>
              <Input
                id="settings-pw-confirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              size="sm"
              onClick={handleChangePassword}
              disabled={passwordSaving || password.length < 4}
            >
              {passwordSaving ? "変更中..." : "パスワードを変更"}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
