import type { TUserData } from "@/@types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  authMe,
  deleteUser,
  fetchUser,
  fetchUsers,
  loginUser,
  logoutUser,
  registerUser,
  restoreUser,
  updateUser,
} from "@/api/user_api";

export function UserData(): TUserData | null {
  const { data } = useAuthMe();
  return data || null;
}

export function useRegisterUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerUser,
    mutationKey: ["register"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useLoginUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loginUser,
    mutationKey: ["login"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useLogoutUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,
    mutationKey: ["logout"],
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
    },
  });
}

export function useAuthMe() {
  return useQuery({
    queryFn: authMe,
    queryKey: ["me"],
    staleTime: 1000 * 60 * 5,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useAllUsersQuery(
  page: number = 1,
  limit: number = 100,
  search?: string,
  yearLevel?: string,
  course?: string,
  includeDeleted?: boolean,
) {
  return useQuery({
    queryFn: () => fetchUsers(page, limit, search, yearLevel, course, includeDeleted),
    queryKey: ["users", page, limit, search, yearLevel, course, includeDeleted],
  });
}

export function useUserQuery(userId: string) {
  return useQuery({
    queryFn: () => fetchUser(userId),
    queryKey: ["user", userId],
    enabled: !!userId,
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) => updateUser(userId, data),
    mutationKey: ["updateUser"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    mutationKey: ["deleteUser"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useRestoreUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreUser,
    mutationKey: ["restoreUser"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
