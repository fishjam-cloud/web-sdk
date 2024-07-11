import type { MediaStreamTrackId } from "./types";

export class Connection {
  public readonly connection: RTCPeerConnection;

  constructor(config: RTCConfiguration) {
    this.connection = new RTCPeerConnection(config)
  }

  public getConnection = (): RTCPeerConnection => {
    return this.connection;
  }

  public addTransceiver = (track: MediaStreamTrack, transceiverConfig: RTCRtpTransceiverInit) => {
    this.connection.addTransceiver(track, transceiverConfig);
  }

  public setOnTrackReady = (onTrackReady: (event: RTCTrackEvent) => void) => {
    this.connection.ontrack = onTrackReady
  }
  public setRemoteDescription = async (data: any) => {
    await this.connection.setRemoteDescription(data)
  }

  public isTrackInUse = (track: MediaStreamTrack) => this.connection.getSenders().some((val) => val.track === track);

  public setTransceiverDirection = () => {
    this.connection
      .getTransceivers()
      .forEach((transceiver) => {
          transceiver.direction = transceiver.direction === 'sendrecv' ? 'sendonly' : transceiver.direction
        },
      );
  };

  public removeTrack = (sender: RTCRtpSender) => {
    this.connection.removeTrack(sender)
  }

  public findSender = (mediaStreamTrackId: MediaStreamTrackId): RTCRtpSender =>
    this.connection
      .getSenders()
      .find((sender) => sender.track && sender!.track!.id === mediaStreamTrackId)!;

  public addIceCandidate = async (iceCandidate: RTCIceCandidate) => {
    await this.connection.addIceCandidate(iceCandidate);
  }
}
