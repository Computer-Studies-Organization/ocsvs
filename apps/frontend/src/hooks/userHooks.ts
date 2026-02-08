import { useMutation } from "@tanstack/react-query";
import { loginUser, registerUser } from "@/api/user_api";


export const useRegisterUserMutation = () => {
    return useMutation({
        mutationFn: registerUser,
        mutationKey: ["register"]
    })
}

export const useLoginUserMutation = () => {
    return useMutation({
        mutationFn: loginUser,
        mutationKey: ["login"]
    })
}