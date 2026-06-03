import { useState, useCallback, useRef, useEffect } from "react";
import type { Piece, Position, PieceColor } from "../types/chess";
import type { Arena, ColiseumGameState } from "../types/coliseum";
import type { RematchState } from "../types/p2p";
import {
  getColiseumLegalMoves,
  isColiseumInCheck,
  applyColiseumMove,
  hasNoLegalMoves,
} from "../utils/chess/coliseumMoves";
import { generateColiseumArena } from "../utils/chess/coliseumGenerator";
import { arenaToChessPieces } from "./useColiseumGame";
import { makeRoomActions } from "../services/TrysteroService";
import type { Room } from "@trystero-p2p/core";

interface Params {
  arena: Arena;
  role: "host" | "guest" | null;
  playerColor: PieceColor | null;
  actions: ReturnType<typeof makeRoomActions> | null;
  room: Room | null;
}

function createInitialState(arena: Arena, pieces?: Piece[]): ColiseumGameState {
  return {
    arena,
    pieces: pieces ?? arenaToChessPieces(arena),
    currentTurn: "white",
    selectedPiece: null,
    validMoves: [],
    isCheck: false,
    gameOver: false,
    winner: null,
    moveCount: { white: 0, black: 0 },
    moves: [],
  };
}

function applyMoveToState(
  prev: ColiseumGameState,
  piece: Piece,
  to: Position,
): ColiseumGameState {
  const newPieces = applyColiseumMove(piece, to, prev.pieces);
  const opponent = prev.currentTurn === "white" ? "black" : "white";
  const opponentInCheck = isColiseumInCheck(opponent, newPieces, prev.arena);
  const opponentHasNoMoves = hasNoLegalMoves(opponent, newPieces, prev.arena);

  return {
    ...prev,
    pieces: newPieces,
    currentTurn: opponent,
    selectedPiece: null,
    validMoves: [],
    isCheck: opponentInCheck,
    gameOver: opponentHasNoMoves,
    winner: opponentHasNoMoves
      ? opponentInCheck
        ? prev.currentTurn
        : null
      : null,
    moveCount: {
      ...prev.moveCount,
      [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1,
    },
    moves: [
      ...prev.moves,
      {
        piece,
        from: piece.position,
        to,
        capturedPiece:
          prev.pieces.find(
            (p) => p.position.x === to.x && p.position.y === to.y,
          ) ?? null,
        wasPromotion: false,
      },
    ],
  };
}

export function useColiseumP2PGame({
  arena,
  role,
  playerColor,
  actions,
  room,
}: Params) {
  const startTimeRef = useRef<number>(Date.now());
  const [state, setState] = useState<ColiseumGameState>(() =>
    createInitialState(arena),
  );
  const stateRef = useRef<ColiseumGameState>(state);
  const seqRef = useRef(0);
  const [rematchState, setRematchState] = useState<RematchState>("idle");
  const [peerLeft, setPeerLeft] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Register P2P message handlers
  useEffect(() => {
    if (!actions) return;

    if (role === "host") {
      actions.onMoveProposal((msg) => {
        const s = stateRef.current;
        const piece = s.pieces.find(
          (p) => p.id === msg.pieceId && p.color === "black",
        );
        if (!piece || s.currentTurn !== "black" || s.gameOver) {
          actions.sendMoveReject({ type: "move_reject" });
          return;
        }
        const valid = getColiseumLegalMoves(piece, s.pieces, s.arena).some(
          (v) => v.x === msg.to.x && v.y === msg.to.y,
        );
        if (!valid) {
          actions.sendMoveReject({ type: "move_reject" });
          return;
        }

        seqRef.current++;
        actions.sendMoveConfirm({
          type: "move_confirm",
          pieceId: msg.pieceId,
          from: msg.from,
          to: msg.to,
          seq: seqRef.current,
        });
        setState((prev) => applyMoveToState(prev, piece, msg.to));
      });

      actions.onRematchRequest(() => setRematchState("offered"));
      actions.onRematchDecline(() => setRematchState("idle"));
      actions.onRematchAccept(() => {
        const newArena = generateColiseumArena(2);
        const pieces = arenaToChessPieces(newArena);
        actions.sendArenaInit({ type: "arena_init", arena: newArena });
        actions.sendRematchStart({ type: "rematch_start", pieces });
        seqRef.current = 0;
        setRematchState("idle");
        setPeerLeft(false);
        startTimeRef.current = Date.now();
        setState(createInitialState(newArena, pieces));
      });
    }

    if (role === "guest") {
      actions.onMoveConfirm((msg) => {
        seqRef.current = msg.seq;
        setState((prev) => {
          const piece = prev.pieces.find((p) => p.id === msg.pieceId);
          return piece ? applyMoveToState(prev, piece, msg.to) : prev;
        });
      });
      actions.onMoveReject(() =>
        setState((prev) => ({ ...prev, selectedPiece: null, validMoves: [] })),
      );
      actions.onRematchRequest(() => setRematchState("offered"));
      actions.onRematchDecline(() => setRematchState("idle"));

      // arena_init arrives before rematch_start — store the new arena in a ref
      const pendingArenaRef = { current: null as Arena | null };
      actions.onArenaInit((msg) => {
        pendingArenaRef.current = msg.arena;
      });
      actions.onRematchStart((msg) => {
        const newArena = pendingArenaRef.current;
        seqRef.current = 0;
        setRematchState("idle");
        setPeerLeft(false);
        startTimeRef.current = Date.now();
        setState(
          newArena
            ? createInitialState(newArena, msg.pieces)
            : (prev) => createInitialState(prev.arena, msg.pieces),
        );
        pendingArenaRef.current = null;
      });
    }

    actions.onResign(() => {
      const opp: PieceColor = playerColor === "white" ? "black" : "white";
      setState((prev) => ({
        ...prev,
        gameOver: true,
        winner: playerColor ?? "white",
        surrenderedBy: opp,
      }));
    });

    room?.onPeerLeave(() => setPeerLeft(true));
  }, [actions, role, playerColor, room]);

  const handlePieceSelect = useCallback(
    (piece: Piece) => {
      setState((prev) => {
        if (prev.gameOver) return prev;
        if (piece.color !== prev.currentTurn) return prev;
        if (piece.color !== playerColor) return prev;
        if (prev.selectedPiece?.id === piece.id) {
          return { ...prev, selectedPiece: null, validMoves: [] };
        }
        const validMoves = getColiseumLegalMoves(
          piece,
          prev.pieces,
          prev.arena,
        );
        return { ...prev, selectedPiece: piece, validMoves };
      });
    },
    [playerColor],
  );

  const handleDeselect = useCallback(() => {
    setState((prev) => ({ ...prev, selectedPiece: null, validMoves: [] }));
  }, []);

  const handleMove = useCallback(
    (to: Position) => {
      if (role === "guest") {
        setState((prev) => {
          if (!prev.selectedPiece) return prev;
          actions?.sendMoveProposal({
            type: "move_proposal",
            pieceId: prev.selectedPiece.id,
            from: prev.selectedPiece.position,
            to,
          });
          return { ...prev, selectedPiece: null, validMoves: [] };
        });
      } else {
        setState((prev) => {
          if (!prev.selectedPiece || prev.gameOver) return prev;
          const isLegal = prev.validMoves.some(
            (m) => m.x === to.x && m.y === to.y,
          );
          if (!isLegal) return prev;
          const newState = applyMoveToState(prev, prev.selectedPiece, to);
          seqRef.current++;
          actions?.sendMoveConfirm({
            type: "move_confirm",
            pieceId: prev.selectedPiece.id,
            from: prev.selectedPiece.position,
            to,
            seq: seqRef.current,
          });
          return newState;
        });
      }
    },
    [role, actions],
  );

  const handleSurrender = useCallback(
    (color: "white" | "black") => {
      actions?.sendResign({ type: "resign" });
      setState((prev) => ({
        ...prev,
        gameOver: true,
        winner: color === "white" ? "black" : "white",
        surrenderedBy: color,
      }));
    },
    [actions],
  );

  const handleRematch = useCallback(() => {
    actions?.sendRematchRequest({ type: "rematch_request" });
    setRematchState("requested");
  }, [actions]);

  const handleAcceptRematch = useCallback(() => {
    if (role === "host") {
      const newArena = generateColiseumArena(2);
      const pieces = arenaToChessPieces(newArena);
      actions?.sendArenaInit({ type: "arena_init", arena: newArena });
      actions?.sendRematchStart({ type: "rematch_start", pieces });
      seqRef.current = 0;
      setRematchState("idle");
      setPeerLeft(false);
      startTimeRef.current = Date.now();
      setState(createInitialState(newArena, pieces));
    } else {
      actions?.sendRematchAccept({ type: "rematch_accept" });
      setRematchState("starting");
    }
  }, [role, actions]);

  const handleDeclineRematch = useCallback(() => {
    actions?.sendRematchDecline({ type: "rematch_decline" });
    setRematchState("idle");
  }, [actions]);

  const getDuration = useCallback(() => Date.now() - startTimeRef.current, []);

  const getTotalMoveCount = useCallback(
    () => state.moveCount.white + state.moveCount.black,
    [state.moveCount],
  );

  return {
    state,
    generating: false as const,
    handlePieceSelect,
    handleDeselect,
    handleMove,
    handleSurrender,
    regenerate: undefined,
    getDuration,
    getTotalMoveCount,
    rematchState,
    peerLeft,
    handleRematch,
    handleAcceptRematch,
    handleDeclineRematch,
  };
}
