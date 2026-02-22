import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authMe, loginUser, logoutUser, registerUser, fetchUsers } from "@/api/user_api";
import { TUserData } from "@/@types";

export const UserData = (): TUserData | null => {
    const { data } = useAuthMe()
    return data || null
}

export const useRegisterUserMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: registerUser,
        mutationKey: ["register"],
    })
}

export const useLoginUserMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: loginUser,
        mutationKey: ["login"],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["me"] });
        }
    })
}

export const useLogoutUserMutation = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: logoutUser,
        mutationKey: ["logout"],
        onSuccess: () => {
            queryClient.setQueryData(["me"], null)
        }
    })
}

export const useAuthMe = () => {
    return useQuery({
        queryFn: authMe,
        queryKey: ["me"],
        staleTime: 1000 * 60 * 5,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    })
}

export const useAllUsersQuery = (page: number = 1, limit: number = 100) => {
    return useQuery({
        queryFn: () => fetchUsers(page, limit),
        queryKey: ["users", page, limit],
    })
}
