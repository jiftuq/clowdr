import { gql } from "@apollo/client";
import { Box, Flex, Heading, useColorModeValue } from "@chakra-ui/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ScrollContainer from "react-indiana-drag-scroll";
import {
    Permission_Enum,
    Timeline_ContentGroup_PartialInfoFragment,
    Timeline_EventFragment,
    Timeline_RoomFragment,
    Timeline_SelectRoomsQuery,
    useTimeline_SelectRoomsQuery,
} from "../../../../generated/graphql";
import PageNotFound from "../../../Errors/PageNotFound";
import ApolloQueryWrapper from "../../../GQL/ApolloQueryWrapper";
import usePrimaryMenuButtons from "../../../Menu/usePrimaryMenuButtons";
import { useTitle } from "../../../Utils/useTitle";
import RequireAtLeastOnePermissionWrapper from "../../RequireAtLeastOnePermissionWrapper";
import { useConference } from "../../useConference";
import DayList from "./DayList";
import NowMarker from "./NowMarker";
import RoomNameBox from "./RoomNameBox";
import RoomTimeline from "./RoomTimeline";
import Scroller, { ScrollerProvider } from "./Scroller";
import TimeBar, { useGenerateMarkers } from "./TimeBar";
import TimelineZoomControls from "./TimelineZoomControls";
import { TimelineParameters } from "./useTimelineParameters";

gql`
    fragment Timeline_ContentItem on ContentItem {
        id
        contentTypeName
        name
        isHidden
        layoutData
    }

    fragment Timeline_ContentItem_WithData on ContentItem {
        ...Timeline_ContentItem
        data
    }

    fragment Timeline_ContentPerson on ContentPerson {
        id
        name
        affiliation
    }

    fragment Timeline_ContentGroupPerson on ContentGroupPerson {
        id
        priority
        roleName
        person {
            ...Timeline_ContentPerson
        }
    }

    fragment Timeline_ContentGroup on ContentGroup {
        id
        contentGroupTypeName
        title
        abstractContentItems: contentItems(where: { contentTypeName: { _eq: ABSTRACT } }) {
            ...Timeline_ContentItem_WithData
        }
        people {
            ...Timeline_ContentGroupPerson
        }
    }

    fragment Timeline_Event_FullInfo on Event {
        id
        roomId
        intendedRoomModeName
        name
        startTime
        durationSeconds
        contentGroup {
            ...Timeline_ContentGroup
        }
    }

    fragment Timeline_Event on Event {
        id
        roomId
        name
        startTime
        durationSeconds
        contentGroupId
    }

    fragment Timeline_Room on Room {
        id
        name
        currentModeName
        priority
    }

    fragment Timeline_ContentGroup_PartialInfo on ContentGroup {
        id
        title
    }

    query Timeline_SelectEvent($id: uuid!) {
        Event_by_pk(id: $id) {
            ...Timeline_Event_FullInfo
        }
    }

    query Timeline_SelectRooms($conferenceId: uuid!) {
        Room(
            where: {
                conferenceId: { _eq: $conferenceId }
                roomPrivacyName: { _eq: PUBLIC }
                events: { id: { _is_null: false } }
            }
        ) {
            ...Timeline_Room
        }
        Event(where: { conferenceId: { _eq: $conferenceId } }) {
            ...Timeline_Event
        }
        ContentGroup(where: { conferenceId: { _eq: $conferenceId } }) {
            ...Timeline_ContentGroup_PartialInfo
        }
    }
`;

function ConferenceTimelineInner({
    rooms: unsortedRooms,
    events,
    contentGroups,
}: {
    rooms: ReadonlyArray<Timeline_RoomFragment>;
    events: ReadonlyArray<Timeline_EventFragment>;
    contentGroups: ReadonlyArray<Timeline_ContentGroup_PartialInfoFragment>;
}): JSX.Element {
    const conference = useConference();
    const { setPrimaryMenuButtons } = usePrimaryMenuButtons();
    useEffect(() => {
        setPrimaryMenuButtons([
            {
                key: "conference-home",
                action: `/conference/${conference.slug}`,
                text: conference.shortName,
                label: conference.shortName,
            },
        ]);
    }, [conference.shortName, conference.slug, setPrimaryMenuButtons]);

    const rooms = useMemo(() => {
        return [...unsortedRooms].sort((x, y) => x.name.localeCompare(y.name)).sort((x, y) => x.priority - y.priority);
    }, [unsortedRooms]);

    const roomRowHeight = 70;
    const timeBarHeight = 5 + roomRowHeight / 2;
    const borderColour = useColorModeValue("gray.400", "gray.400");

    const timeBarF = useCallback(
        (key: string, mt?: string) => (
            <TimeBar key={key} height={timeBarHeight} borderColour={borderColour} marginTop={mt} />
        ),
        [borderColour, timeBarHeight]
    );

    const alternateBgColor = useColorModeValue("blue.100", "blue.700");

    const rowInterval = Math.round((window.innerHeight - 250) / roomRowHeight);
    const timeBarSeparation = "2em";

    const roomNameBoxes = useMemo(
        () =>
            rooms.reduce(
                (acc, room, idx) => [
                    ...acc,
                    idx > 0 && idx % rowInterval === 0 ? (
                        <RoomNameBox
                            key={"filler-" + idx}
                            room={""}
                            height={timeBarHeight}
                            showBottomBorder={true}
                            borderColour={borderColour}
                            backgroundColor={alternateBgColor}
                            marginTop={timeBarSeparation}
                        />
                    ) : undefined,
                    <RoomNameBox
                        key={room.id}
                        room={room}
                        height={roomRowHeight}
                        showBottomBorder={true}
                        borderColour={borderColour}
                        backgroundColor={idx % 2 === 1 ? alternateBgColor : undefined}
                    />,
                ],
                [] as (JSX.Element | undefined)[]
            ),
        [alternateBgColor, borderColour, rooms, rowInterval, timeBarHeight]
    );

    const [scrollCallbacks, setScrollCallbacks] = useState<Map<string, (ev: Timeline_EventFragment) => void>>(
        new Map()
    );

    const roomTimelines = useMemo(
        () =>
            rooms.reduce(
                (acc, room, idx) => [
                    ...acc,
                    idx % rowInterval === 0
                        ? timeBarF("timeline-" + idx, idx > 0 ? timeBarSeparation : undefined)
                        : undefined,
                    <Box
                        key={room.id}
                        w="100%"
                        h={roomRowHeight + "px"}
                        borderBottomWidth={idx !== rooms.length - 1 ? 1 : 0}
                        borderBottomStyle="solid"
                        borderBottomColor={borderColour}
                    >
                        <RoomTimeline
                            room={room}
                            hideTimeShiftButtons={true}
                            hideTimeZoomButtons={true}
                            height={roomRowHeight}
                            setScrollToEvent={(cb) => {
                                setScrollCallbacks((old) => {
                                    const newMap = new Map(old);
                                    newMap.set(room.id, cb);
                                    return newMap;
                                });
                            }}
                            events={events}
                            contentGroups={contentGroups}
                        />
                    </Box>,
                ],
                [] as (JSX.Element | undefined)[]
            ),
        [borderColour, contentGroups, events, rooms, rowInterval, timeBarF]
    );

    const roomMarkers = useGenerateMarkers(`calc(100% - ${timeBarHeight}px)`, "", true, false, false);

    const scrollToEvent = useCallback(
        (ev: Timeline_EventFragment) => {
            const cb = scrollCallbacks.get(ev.roomId);
            cb?.(ev);
        },
        [scrollCallbacks]
    );

    const [scrollToNow, setScrollToNow] = useState<{ f: () => void }>({
        f: () => {
            /*EMPTY*/
        },
    });

    const labeledNowMarker = useMemo(
        () => (
            <NowMarker
                showLabel
                setScrollToNow={(cb) => {
                    setScrollToNow({ f: cb });
                }}
            />
        ),
        []
    );

    const title = useTitle(`Schedule of ${conference.shortName}`);

    return (
        <>
            {title}
            <Heading as="h1">Schedule</Heading>
            <Box w="100%" p={2}>
                <Flex w="100%" direction="row" justify="center" alignItems="center">
                    <DayList rooms={rooms} events={events} scrollToEvent={scrollToEvent} scrollToNow={scrollToNow.f} />
                    <TimelineZoomControls />
                </Flex>
                <Box
                    cursor="pointer"
                    as={ScrollContainer}
                    w="100%"
                    maxHeight="calc(100vh - 300px)"
                    horizontal={false}
                    borderColor={borderColour}
                    borderWidth={1}
                    borderStyle="solid"
                    hideScrollbars={false}
                >
                    <Flex
                        direction="row"
                        w="100%"
                        justifyContent="stretch"
                        alignItems="flex-start"
                        role="region"
                        aria-label="Conference schedule"
                    >
                        {window.innerWidth > 500 ? (
                            <Box flex="1 0 max-content" role="list" aria-label="Rooms">
                                <RoomNameBox
                                    room="Rooms"
                                    height={timeBarHeight}
                                    showBottomBorder={true}
                                    borderColour={borderColour}
                                    backgroundColor={alternateBgColor}
                                />
                                {roomNameBoxes}
                            </Box>
                        ) : undefined}
                        <Scroller>
                            {roomMarkers}
                            <NowMarker />
                            {labeledNowMarker}
                            {roomTimelines}
                        </Scroller>
                    </Flex>
                </Box>
            </Box>
        </>
    );
}

function ConferenceTimelineIntermediaryWrapper({
    rooms,
    events,
    contentGroups,
}: {
    rooms: ReadonlyArray<Timeline_RoomFragment>;
    events: ReadonlyArray<Timeline_EventFragment>;
    contentGroups: ReadonlyArray<Timeline_ContentGroup_PartialInfoFragment>;
}): JSX.Element {
    const { earliestStart, latestEnd } = useMemo<{ earliestStart: number; latestEnd: number }>(() => {
        return events.reduce<{ earliestStart: number; latestEnd: number }>(
            (x, event) => {
                const startT = Date.parse(event.startTime);
                const endT = startT + event.durationSeconds * 1000;
                if (startT < x.earliestStart) {
                    if (endT > x.latestEnd) {
                        return {
                            earliestStart: startT,
                            latestEnd: endT,
                        };
                    } else {
                        return {
                            earliestStart: startT,
                            latestEnd: x.latestEnd,
                        };
                    }
                } else if (endT > x.latestEnd) {
                    return {
                        earliestStart: x.earliestStart,
                        latestEnd: endT,
                    };
                }
                return x;
            },
            { earliestStart: Number.POSITIVE_INFINITY, latestEnd: Number.NEGATIVE_INFINITY }
        );
    }, [events]);

    return (
        <TimelineParameters earliestEventStart={earliestStart} latestEventEnd={latestEnd}>
            <ScrollerProvider>
                <ConferenceTimelineInner rooms={rooms} events={events} contentGroups={contentGroups} />
            </ScrollerProvider>
        </TimelineParameters>
    );
}

function ConferenceTimelineFetchWrapper(): JSX.Element {
    const conference = useConference();
    const roomsResult = useTimeline_SelectRoomsQuery({
        variables: {
            conferenceId: conference.id,
        },
    });
    return (
        <ApolloQueryWrapper<
            Timeline_SelectRoomsQuery,
            unknown,
            {
                rooms: ReadonlyArray<Timeline_RoomFragment>;
                events: ReadonlyArray<Timeline_EventFragment>;
                contentGroups: ReadonlyArray<Timeline_ContentGroup_PartialInfoFragment>;
            }
        >
            queryResult={roomsResult}
            getter={(x) => ({ rooms: x.Room, events: x.Event, contentGroups: x.ContentGroup })}
        >
            {(data) => <ConferenceTimelineIntermediaryWrapper {...data} />}
        </ApolloQueryWrapper>
    );
}

export default function ConferenceTimeline(): JSX.Element {
    return (
        <RequireAtLeastOnePermissionWrapper
            componentIfDenied={<PageNotFound />}
            permissions={[Permission_Enum.ConferenceView, Permission_Enum.ConferenceManageSchedule]}
        >
            <ConferenceTimelineFetchWrapper />
        </RequireAtLeastOnePermissionWrapper>
    );
}
