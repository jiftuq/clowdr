import assert from "assert";
import React, { useCallback, useMemo, useState } from "react";
import { Chat_MessageType_Enum } from "../../../generated/graphql";
import { useRealTime } from "../../Generic/useRealTime";
import { ChatConfiguration, useChatConfiguration } from "../Configuration";
import { useSelectedChat } from "../SelectedChat";
import type { MinMax } from "../Types/Base";
import type { AnswerMessageData, MessageData, OrdinaryMessageData } from "../Types/Messages";
import { useSendMessageQueries } from "./SendMessageQueries";

interface ComposeCtx {
    newMessage: string;
    newMessageType: Chat_MessageType_Enum;
    newMessageData: MessageData;

    messageLengthRange: MinMax;

    lastSendTime: number;
    readyToSend: boolean;
    blockedReason: string | undefined;

    setNewMessage: (msg: string) => void;
    setNewMessageType: (type: Chat_MessageType_Enum) => void;
    setNewMessageData: (data: MessageData) => void;

    isSending: boolean;
    sendError: string | undefined;
    send: (data?: MessageData) => void;
    clearSendError: () => void;

    setAnsweringQuestionId: (ids: number[] | null) => void;
}

const ComposeContext = React.createContext<ComposeCtx | undefined>(undefined);

export function useComposeContext(): ComposeCtx {
    const ctx = React.useContext(ComposeContext);
    if (!ctx) {
        throw new Error("Context not available - are you outside the provider?");
    }
    return ctx;
}

export function defaultAvailableMessageType(config: ChatConfiguration): Chat_MessageType_Enum | undefined {
    if (config.permissions.canMessage) {
        return Chat_MessageType_Enum.Message;
    }
    if (config.permissions.canEmote) {
        return Chat_MessageType_Enum.Emote;
    }
    if (config.permissions.canQuestion) {
        return Chat_MessageType_Enum.Question;
    }
    if (config.permissions.canAnswer) {
        return Chat_MessageType_Enum.Answer;
    }
    if (config.permissions.canPoll) {
        return Chat_MessageType_Enum.Poll;
    }
}

export function ComposeContextProvider({
    children,
    setAnsweringQuestionIdRef,
}: {
    children: React.ReactNode | React.ReactNodeArray;
    setAnsweringQuestionIdRef: React.RefObject<{ f: (ids: number[] | null) => void; answeringIds: number[] | null }>;
}): JSX.Element {
    const config = useChatConfiguration();
    const defaultType = defaultAvailableMessageType(config);
    assert(defaultType !== undefined, "No available message types to send!");
    const [newMessage, setNewMessage] = useState<string>("");
    const [newMessageType, setNewMessageType] = useState<Chat_MessageType_Enum>(defaultType);
    const [newMessageData, setNewMessageData] = useState<MessageData>({});
    const [lastSendTime, setLastSendTime] = useState<number>(0);
    const [isSending, setIsSending] = useState<boolean>(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const now = useRealTime(250);
    const sendQueries = useSendMessageQueries();
    const selectedChat = useSelectedChat();

    const minLength =
        useMemo(() => {
            switch (newMessageType) {
                case Chat_MessageType_Enum.Message:
                    return config.messageConfig.length?.min;
                case Chat_MessageType_Enum.Emote:
                    return 1;
                case Chat_MessageType_Enum.Question:
                    return config.questionConfig.length?.min;
                case Chat_MessageType_Enum.Answer:
                    return config.answerConfig.length?.min;
                case Chat_MessageType_Enum.Poll:
                    return config.pollConfig.questionLength?.min;
            }
        }, [
            newMessageType,
            config.answerConfig.length?.min,
            config.messageConfig.length?.min,
            config.pollConfig.questionLength?.min,
            config.questionConfig.length?.min,
        ]) ?? 0;

    const maxLength = useMemo(() => {
        switch (newMessageType) {
            case Chat_MessageType_Enum.Message:
                return config.messageConfig.length?.max;
            case Chat_MessageType_Enum.Emote:
                return 1;
            case Chat_MessageType_Enum.Question:
                return config.questionConfig.length?.max;
            case Chat_MessageType_Enum.Answer:
                return config.answerConfig.length?.max;
            case Chat_MessageType_Enum.Poll:
                return config.pollConfig.questionLength?.max;
        }
    }, [
        newMessageType,
        config.answerConfig.length?.max,
        config.messageConfig.length?.max,
        config.pollConfig.questionLength?.max,
        config.questionConfig.length?.max,
    ]);

    const lockoutTimeMs = useMemo(() => {
        switch (newMessageType) {
            case Chat_MessageType_Enum.Message:
                return config.messageConfig.sendCooloffPeriodMs;
            case Chat_MessageType_Enum.Emote:
                return config.emoteConfig.sendCooloffPeriodMs;
            case Chat_MessageType_Enum.Question:
                return config.questionConfig.sendCooloffPeriodMs;
            case Chat_MessageType_Enum.Answer:
                return config.answerConfig.sendCooloffPeriodMs;
            case Chat_MessageType_Enum.Poll:
                return config.pollConfig.sendCooloffPeriodMs;
        }
    }, [
        newMessageType,
        config.answerConfig.sendCooloffPeriodMs,
        config.emoteConfig.sendCooloffPeriodMs,
        config.messageConfig.sendCooloffPeriodMs,
        config.pollConfig.sendCooloffPeriodMs,
        config.questionConfig.sendCooloffPeriodMs,
    ]);

    const newMessageComparisonV = newMessage.replace(/\s+/gi, " ").trim();

    const blockedReason =
        newMessageComparisonV.length < minLength
            ? `Minimum length ${minLength} character${minLength !== 1 ? "s" : ""}`
            : maxLength !== undefined && newMessageComparisonV.length > maxLength
            ? `${newMessageComparisonV.length} / ${maxLength} character${maxLength !== 1 ? "s" : ""}`
            : newMessageType === Chat_MessageType_Enum.Question && !newMessageComparisonV.includes("?")
            ? "Question mark required."
            : newMessageType === Chat_MessageType_Enum.Answer && !("questionMessagesIds" in newMessageData)
            ? "Please select the question you are answering."
            : undefined;

    const setAnsweringQuestionId = useCallback(
        (ids) => {
            if (ids !== null) {
                if (newMessageType !== Chat_MessageType_Enum.Answer) {
                    setNewMessageType(Chat_MessageType_Enum.Answer);
                }
                const data: AnswerMessageData = {
                    questionMessagesIds: ids,
                };
                setNewMessageData(data);
            } else {
                if (newMessageType === Chat_MessageType_Enum.Answer) {
                    setNewMessageType(Chat_MessageType_Enum.Message);
                    const data: OrdinaryMessageData = {};
                    setNewMessageData(data);
                }
            }
        },
        [newMessageType]
    );

    if (setAnsweringQuestionIdRef?.current) {
        setAnsweringQuestionIdRef.current.f = setAnsweringQuestionId;
        setAnsweringQuestionIdRef.current.answeringIds =
            newMessageType === Chat_MessageType_Enum.Answer
                ? (newMessageData as AnswerMessageData).questionMessagesIds ?? null
                : null;
    }

    const ctx = useMemo(
        () => ({
            newMessage,
            setNewMessage,
            newMessageType,
            setNewMessageType: (type: Chat_MessageType_Enum) => {
                if (type !== newMessageType) {
                    setNewMessageType(type);
                    setNewMessageData({});
                }
            },
            newMessageData,
            setNewMessageData,
            messageLengthRange: {
                min: minLength,
                max: maxLength,
            },
            lastSendTime,
            blockedReason,

            isSending,
            sendError: sendError ?? undefined,
            send: (data?: MessageData) => {
                setIsSending(true);
                (async () => {
                    if (!config.currentAttendeeId || !config.currentAttendeeName) {
                        throw new Error("Not authorized.");
                    }

                    try {
                        const isEmote = /^\p{Emoji}$/iu.test(newMessage);
                        await sendQueries.send(
                            selectedChat.id,
                            config.currentAttendeeId,
                            config.currentAttendeeName,
                            newMessageType === Chat_MessageType_Enum.Message && isEmote
                                ? Chat_MessageType_Enum.Emote
                                : newMessageType,
                            newMessage,
                            data ?? newMessageData,
                            false,
                            selectedChat.title
                        );

                        setNewMessage("");
                        setNewMessageData({});
                        setNewMessageType((old) =>
                            old === Chat_MessageType_Enum.Message || old === Chat_MessageType_Enum.Answer
                                ? old
                                : Chat_MessageType_Enum.Message
                        );
                    } catch (e) {
                        console.error(`${new Date().toLocaleString()}: Failed to send message`, e);
                        setSendError(e.message ?? e.toString());
                        setIsSending(false);
                    } finally {
                        setLastSendTime(Date.now());
                        setIsSending(false);
                    }
                })();
            },
            clearSendError: () => setSendError(null),

            setAnsweringQuestionId,
        }),
        [
            blockedReason,
            config.currentAttendeeId,
            config.currentAttendeeName,
            isSending,
            lastSendTime,
            maxLength,
            minLength,
            newMessage,
            newMessageData,
            newMessageType,
            selectedChat.id,
            sendError,
            sendQueries,
            setAnsweringQuestionId,
        ]
    );

    return (
        <ComposeContext.Provider
            value={{
                ...ctx,
                readyToSend: blockedReason === undefined && (!lockoutTimeMs || now - lastSendTime > lockoutTimeMs),
            }}
        >
            {children}
        </ComposeContext.Provider>
    );
}
