import { MediaEvent_OfferData_TrackTypes } from '../protos/media_events/server/server';
import type { MediaStreamTrackId } from './types';

export type TurnServer = {
  transport: string;
  password: string;
  serverAddr: string;
  serverPort: string;
  username: string;
};

export class ConnectionManager {
  private readonly connection: RTCPeerConnection;
  public readonly isExWebRTC: boolean;

  constructor(turnServers: TurnServer[]) {
    this.isExWebRTC = turnServers.length === 0;

    const iceServers = this.isExWebRTC
      ? [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.l.google.com:5349' }]
      : this.getIceServers(turnServers);
    const iceTransportPolicy = this.isExWebRTC ? 'all' : 'relay';

    this.connection = new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      iceServers: iceServers,
      iceTransportPolicy: iceTransportPolicy,
    });
  }

  public isConnectionUnstable = () => {
    if (!this.connection) return false;

    const isSignalingUnstable = this.connection.signalingState !== 'stable';
    const isConnectionNotConnected = this.connection.connectionState !== 'connected';
    const isIceNotConnected = this.connection.iceConnectionState !== 'connected';

    return isSignalingUnstable && isConnectionNotConnected && isIceNotConnected;
  };

  /**
   * Configures TURN servers for WebRTC connections by adding them to the provided RTCConfiguration object.
   */
  private getIceServers = (turnServers: TurnServer[]): RTCIceServer[] => {
    return turnServers.map((turnServer: TurnServer) => {
      const transport = turnServer.transport === 'tls' ? 'tcp' : turnServer.transport;
      const uri = turnServer.transport === 'tls' ? 'turns' : 'turn';
      const address = turnServer.serverAddr;
      const port = turnServer.serverPort;

      return {
        credential: turnServer.password,
        urls: uri.concat(':', address, ':', port, '?transport=', transport),
        username: turnServer.username,
      };
    });
  };

  public getConnection = (): RTCPeerConnection => {
    return this.connection;
  };

  public addTransceiversIfNeeded = (serverTracks: MediaEvent_OfferData_TrackTypes) => {
    const recvTransceivers = this.connection.getTransceivers().filter((elem) => elem.direction === 'recvonly');

    const videoTransceiversAmount = recvTransceivers.filter((elem) => elem.receiver.track.kind === 'video').length;
    const audioTransceiversAmount = recvTransceivers.filter((elem) => elem.receiver.track.kind === 'audio').length;

    const videoNeededTypes = Array<string>(serverTracks.video - videoTransceiversAmount).fill('video');
    const audioNeededTypes = Array<string>(serverTracks.audio - audioTransceiversAmount).fill('audio');

    [...videoNeededTypes, ...audioNeededTypes].forEach((kind) =>
      this.connection.addTransceiver(kind, { direction: 'recvonly' }),
    );
  };

  public addTransceiver = (track: MediaStreamTrack, transceiverConfig: RTCRtpTransceiverInit) => {
    this.connection.addTransceiver(track, transceiverConfig);
  };

  public setOnTrackReady = (onTrackReady: (event: RTCTrackEvent) => void) => {
    this.connection.ontrack = onTrackReady;
  };
  public setRemoteDescription = async (data: RTCSessionDescriptionInit) => {
    await this.connection.setRemoteDescription(data);
  };

  public isTrackInUse = (track: MediaStreamTrack) => this.connection.getSenders().some((val) => val.track === track);

  public removeTrack = (sender: RTCRtpSender) => {
    this.connection.removeTrack(sender);
  };

  public findSender = (mediaStreamTrackId: MediaStreamTrackId): RTCRtpSender =>
    this.connection.getSenders().find((sender) => sender.track && sender.track.id === mediaStreamTrackId)!;

  public addIceCandidate = async (iceCandidate: RTCIceCandidate) => {
    await this.connection.addIceCandidate(iceCandidate);
  };
}
