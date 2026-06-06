'use client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authApi } from '@/lib/api/auth';
import type { LoginRequest, RegisterRequest, Association } from '@/lib/types/auth';

export function useAuth() {
  const {
    user, associations, activeAssociation, currentMembership,
    setUser, setAssociations, setActiveAssociation, setCurrentMembership,
    logout,
  } = useAuthStore();

  const login = async (data: LoginRequest) => {
    const res = await authApi.login(data);
    localStorage.setItem('access_token', res.tokens.access);
    localStorage.setItem('refresh_token', res.tokens.refresh);
    setUser(res.user);

    const { associations: list, active_slug } = await authApi.myAssociations();
    setAssociations(list);

    if (list.length > 0) {
      const active = list.find(a => a.slug === active_slug) || list[0];
      setActiveAssociation(active);
    }
    return res;
  };

  const register = async (data: RegisterRequest) => {
    const res = await authApi.register(data);
    localStorage.setItem('access_token', res.tokens.access);
    localStorage.setItem('refresh_token', res.tokens.refresh);
    setUser(res.user);
    return res;
  };

  const switchAssociation = async (assoc: Association) => {
    await authApi.selectAssociation(assoc.slug);
    setActiveAssociation(assoc);
  };

  return {
    user, associations, activeAssociation, currentMembership,
    login, register, logout,
    setActiveAssociation, switchAssociation, setCurrentMembership,
  };
}
