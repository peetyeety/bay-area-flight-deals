export default function SignOutButton() {
  return <form action="/auth/signout" method="post"><button className="sign-out-button" type="submit">Sign out</button></form>;
}
