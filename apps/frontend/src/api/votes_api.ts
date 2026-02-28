import { TVoteResultsResponse, TVoteStatus } from "@/@types";
import { api } from "./axios";

export const submitVotes = async (candidateIds: string[]) => {
    const votes = candidateIds.map(candidateId => ({ candidateId }));
    const response = await api.post("/votes", { votes });
    return response.data;
}

export const getMyVotes = async (): Promise<TVoteStatus> => {
    const response = await api.get("/votes/me");
    return response.data;
}

export const getVoteResults = async (): Promise<TVoteResultsResponse> => {
    const response = await api.get("/votes/results");
    return response.data;
}

export const getCandidateVoteCount = async (candidateId: string): Promise<{ candidateId: string; candidateName: string; position: string; voteCount: number }> => {
    const response = await api.get(`/votes/candidates/${candidateId}/count`);
    return response.data;
}
