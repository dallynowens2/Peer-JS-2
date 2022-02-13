import { useEffect, useState, useRef } from "react";
import Peer from "peerjs";

const randId = () => {
  let roomLength = 5;
  let lowChar = "A".charCodeAt(0);
  let highChar = "Z".charCodeAt(0);
  let possibleChars = highChar - lowChar + 1;
  let randChar = () => {
    let r = Math.round(Math.random() * possibleChars) + lowChar;
    return String.fromCharCode(r);
  };
  return [...new Array(roomLength).keys()].map(randChar).join("");
};

function App() {
  const [peerId, setPeerId] = useState("");
  const [message, setMessage] = useState("");
  const [recepients, setRecepients] = useState("");
  const [broadcastMessages, setBroadcastMessages] = useState([]);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [peer, setPeer] = useState(new Peer(randId()));

  //sendSeq := 0; delivered := h0, 0, . . . , 0i; buffer := {}


  const [lamportClock, setLamportClock] = useState(1);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sendSeq, setSendSeq] = useState(0);
  const [delivered, setDelivered] = useState({});
  const [buffer, setBuffer] = useState([]);

  const receivedMessagesRef = useRef(messages)
  const connectionsRef = useRef(connections)
  const lamportClockRef = useRef(lamportClock)
  const sendSeqRef = useRef(sendSeq)
  const deliveredRef = useRef(delivered)
  const bufferRef = useRef(buffer)

  connectionsRef.current = connections
  receivedMessagesRef.current = messages
  lamportClockRef.current = lamportClock
  sendSeqRef.current = sendSeq
  deliveredRef.current = delivered
  bufferRef.current = buffer

  useEffect(() => {
    peer.on("open", (id) => {
      console.log("My id: " + id);
    });
    peer.on("connection", (conn) => {
      configureConnection(conn);
      console.log("Connected to peer: " + conn.peer);
    });
  }, [peer]);


  const addPeer = () => {
    const conn = peer.connect(peerId);
    console.log("Connecting to: ", conn.peer);

    configureConnection(conn);
    setPeerId("");
  };

  const configureConnection = (conn) => {
    conn.on("open", () => {
      setConnections((prev) => [...prev, conn]);
      setDelivered({ ...delivered, [conn.peer]: 0 });
      
      conn.on("data", (data) => {
        console.log(data);

        if (data.tempLamportClock > lamportClock) {
          setLamportClock(data.tempLamportClock + 1);
        } else {
          setLamportClock(lamportClock + 1);
        }


        if (data.isBroadcasted) {
          //check if data.message is not already in broadcastMessages
          if (receivedMessagesRef.current.findIndex(x => x.message === data.message) === -1) {

            // buffer := buffer ∪ {msg}
            // while ∃(sender , deps, m) ∈ buffer . deps ≤ delivered do
            // deliver m to the application
            // buffer := buffer \ {(sender , deps, m)}
            // delivered[sender ] := delivered[sender ] + 1
            // end while

            setBuffer(prev => ([...prev, data]))
            console.log("buffer" , bufferRef.current, "delivered" , deliveredRef.current)

            while (bufferRef.current.findIndex(x => x.deps[data.sender] <= deliveredRef.current[data.sender]) !== -1) {
              console.log("inside the while loop")
              const message = bufferRef.current.find(x => x.originatorLamport <= deliveredRef.current[data.sender])
              setBroadcastMessages(prev => ([...prev, message]))

              setDelivered(prev => ({...prev, [message.sender]: deliveredRef.current[message.sender] + 1}))
              setBuffer(prev => prev.filter(x => x.originatorLamport > deliveredRef.current[message.sender]))
            }

            setMessages(c => ([...c, data]))
  
            const broadcastedMessage = {tempLamportClock: lamportClock, author: data.author, sentBy: peer.id, originatorLamport: data.originatorLamport, message: data.message, isBroadcasted: true, deps: deliveredRef.current}
  
            //broadcast message to all connections
            connectionsRef.current.forEach(x => x.send(broadcastedMessage))
          }else{
            console.log("message already broadcasted and received from", data.sentBy);
            // setMessages((prev) => [...prev, data]);
          }
        }else{
          setMessages((prev) => [...prev, data]);
        }
      });

    });
  };


  const sendMessageHandler = () => {
    // deps := delivered; deps[i] := sendSeq
    const messageObj = {
      message,
      timeSent: new Date(),
      author: peer.id,
      sentBy: peer.id,
      tempLamportClock: lamportClock + 1,
      isBroadcasted: isBroadcast,
      originatorLamport: "",
      deps: []
    };
    sendMessage(messageObj);
    setMessages((prev) => [...prev, messageObj]);
    setMessage("");
  };

  const sendMessage = (m) => {
    setLamportClock(lamportClock + 1);

    if (recepients.trim().length > 0) {
      const rec = recepients.split(",");
      rec.forEach((r) => connections[r - 1].send(m));
    } else {
      var deps = deliveredRef.current;
      deps[peer.id] = sendSeqRef.current;
      setSendSeq(sendSeqRef.current + 1);
      setDelivered({ ...delivered, [peer.id]: sendSeqRef.current });
      
      //update m
      m.deps = deps;

      console.log("broadcast message in send: ", m, " to: ", connections, "broadcastMessages: ", broadcastMessages);
      connectionsRef.current.forEach(x => x.send(m));
    }
  };

  const forwardMessage = (m) => {
    const newM = { ...m };
    newM.sentBy = peer.id;
    sendMessage(newM);
  };

  const connectPeer = (id) => {
    const conn = peer.connect(id);
    console.log("Connecting to: ", conn.peer);
    setConnections(c => ([...c, conn]))
    //configureConnection(conn);
  };

  const messageChangeHandler = (e) => {
    setMessage(e.target.value);
  };
  const onPeerIdChange = (e) => {
    setPeerId(e.target.value);
  };
  const onRecepientChange = (e) => {
    setRecepients(e.target.value);
  };
  const onEventClickhandler = () => {
    setLamportClock(lamportClock + 1);
  };
  const onCheckHandler = () => {
    setIsBroadcast(!isBroadcast);
    console.log(isBroadcast);
  };

  return (
    <div className="App">
      <h2>My Id:</h2>
      <p>{peer.id}</p>
      <div>
        <label>Peer Id</label>
        <br />
        <input type="text" value={peerId} onChange={onPeerIdChange} />
        <button type="button" onClick={addPeer}>
          Add Peer
        </button>
      </div>
      <div>
        <label>
          Enter Recepients. NOTE: please separate them with commas (e.g. 1, 2,
          3)
        </label>
        <br />
        <input type="text" value={recepients} onChange={onRecepientChange} />
        <p>
          Message will be sent to:{" "}
          {recepients.trim().length > 0 ? recepients : "All"}
        </p>
      </div>
      <div>
        <label>Enter Message</label>
        <br />
        <input type="text" value={message} onChange={messageChangeHandler} />
        <button type="button" onClick={sendMessageHandler}>
          Send Message
        </button>
        <br />
        <label>Broadcast Message</label>
        <input type="checkbox" onClick={onCheckHandler}/>
      </div>
      <div>
        <h4>Connections</h4>
        {connections.map((c, i) => {
          return (
            <div key={i}>
              <p>{`${i + 1}) ${c.peer}`}</p>
            </div>
          );
        })}
      </div>
      <div>
        <button type="button" onClick={onEventClickhandler}>
          Event
        </button>
        <br />
        Lamport Clock: {lamportClock}
      </div>
      <div>
        <h4>Messages</h4>
        {messages.map((m, i) => {
          return (
            <div key={`m_${i}`}>
              <span>{`Lamport Clock <${m.tempLamportClock}, ${m.sentBy}>: ${m.message}`}</span>
              <button type="button" onClick={() => forwardMessage(m)}>
                Forward
              </button>
              {m.sentBy !== m.author && (
                <>
                  <span>Connect to {m.author}?</span>
                  <button type="button" onClick={() => connectPeer(m.author)}>
                    Connect
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
