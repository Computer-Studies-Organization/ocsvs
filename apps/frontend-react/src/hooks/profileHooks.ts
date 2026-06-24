import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changePassword, getMyProfile, updateMyProfile } from "@/api/profile_api";

export function useMyProfileQuery() {
  return useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myProfile"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: changePassword,
  });
}
