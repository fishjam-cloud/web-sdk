export const setTurns = (
  turnServers: any[],
  rtcConfig: RTCConfiguration,
): void => {
  turnServers.forEach((turnServer: any) => {
    let transport, uri;
    if (turnServer.transport == 'tls') {
      transport = 'tcp';
      uri = 'turns';
    } else {
      transport = turnServer.transport;
      uri = 'turn';
    }

    const rtcIceServer: RTCIceServer = {
      credential: turnServer.password,
      urls: uri.concat(
        ':',
        turnServer.serverAddr,
        ':',
        turnServer.serverPort,
        '?transport=',
        transport,
      ),
      username: turnServer.username,
    };

    rtcConfig.iceServers!.push(rtcIceServer);
  });
};
