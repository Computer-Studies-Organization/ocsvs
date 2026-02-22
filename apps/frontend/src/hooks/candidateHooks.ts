import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { allCandidates, createCandidate } from "@/api/candidate_api";


export const useAllCandidatesQuery = () => {
    return useQuery({
        queryFn: allCandidates,
        queryKey: ["candidates"]
    })
}

export const useCreateCandidateMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createCandidate,
        mutationKey: ["candidates"],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["candidates"] });
        }
    })
}
