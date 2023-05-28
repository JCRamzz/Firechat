import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import Filter from "bad-words";

import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import "firebase/compat/analytics";

import { useAuthState } from "react-firebase-hooks/auth";
import { useCollectionData } from "react-firebase-hooks/firestore";

firebase.initializeApp({
  //your config
});

const auth = firebase.auth();
const firestore = firebase.firestore();
const analytics = firebase.analytics();
const { Timestamp } = firebase.firestore();

const profanityFilter = new Filter();

function App() {
  const [user] = useAuthState(auth);

  return (
    <div className="App">
      <header>
        <h1>Firechat🔥</h1>
        <SignOut />
      </header>

      <section>
        {user ? <ChatRoom /> : <SignIn />}{" "}
        {/* If user is signed in, show chat, else: show sign in*/}
      </section>
    </div>
  );
}

function SignIn() {
  const signInWithGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
  };

  return <button onClick={signInWithGoogle}> Sign In With Google </button>;
}

function SignOut() {
  return (
    auth.currentUser && (
      <button onClick={() => auth.signOut()}> Sign Out </button>
    )
  );
}

function ChatRoom() {
  const scroll = useRef();

  const messagesRef = firestore.collection("messages");
  const query = messagesRef.orderBy("createdAt").limit(25);

  // Listen to data with this hook, returns an array of objects, each obj is a message in the db
  const [messages] = useCollectionData(query, { idField: "id" });

  const [formValue, setFormValue] = useState("");

  const sendMessage = async (e) => {
    e.preventDefault();

    const { uid, photoURL } = auth.currentUser;
    // applying a profanity filter using the 'bad-words' package
    let filteredText = profanityFilter.clean(formValue);

    //creates a new document in firestore
    await messagesRef.add({
      text: filteredText,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid,
      photoURL,
    });

    setFormValue("");

    scroll.current.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const deleteExpiredMessages = async () => {
      const expirationTime =
        firebase.firestore.Timestamp.now().toMillis() - 2 * 60 * 1000;
      const querySnapshot = await firestore
        .collection("messages")
        .where(
          "createdAt",
          "<=",
          firebase.firestore.Timestamp.fromMillis(expirationTime)
        )
        .get();

      const batch = firestore.batch();

      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      console.log("Number of expired messages:", querySnapshot.size);

      await batch.commit();

      console.log("Expired messages deleted:", querySnapshot.size);
    };

    const deletionInterval = setInterval(deleteExpiredMessages, 60 * 1000);

    return () => clearInterval(deletionInterval);
  }, [firestore]);

  return (
    <>
      <main>
        {messages &&
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}

        <div ref={scroll}></div>
      </main>

      <form onSubmit={sendMessage}>
        <input
          value={formValue}
          onChange={(e) => setFormValue(e.target.value)}
        />

        <button type="submit">💬</button>
      </form>
    </>
  );
}

function ChatMessage(props) {
  const { text, uid, photoURL } = props.message;
  const messageClass = uid === auth.currentUser.uid ? "sent" : "received";
  const [user] = useAuthState(auth);

  let displayName = "";
  if (user) {
    displayName = user.displayName || "";
  }

  const senderStyle = {
    fontWeight: "bold",
    color: "#FC6E51",
    marginBottom: "-14px",
    fontSize: "14px",
    background: "none",
    border: "none",
    boxShadow: "none",
    padding: "0",
  };

  return (
    <div className={`message ${messageClass} fade`}>
      {" "}
      {/* Add the fade class here */}
      <img src={photoURL} alt="Profile" />
      <div>
        <p className="message-sender" style={senderStyle}>
          {displayName}
        </p>
        <p className="message-text">{text}</p>
      </div>
    </div>
  );
}

export default App;
