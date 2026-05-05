import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changePassword, getMyProfile, updateMyProfile, type ChangePasswordData, type UpdateProfileData } from '@/api/profile_api'

export const useMyProfileQuery = () => {
  return useQuery({
    queryKey: ['myProfile'],
    queryFn: getMyProfile,
  })
}

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] })
    },
  })
}

export const useChangePasswordMutation = () => {
  return useMutation({
    mutationFn: changePassword,
  })
}
