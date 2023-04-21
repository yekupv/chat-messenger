import { fetchRedis } from "@/helpers/redis";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { toPusherKey } from "@/lib/utils";
import { addFriendValidator } from "@/lib/validations/add-friend";
import { getServerSession } from "next-auth";
import { z } from "zod";

export async function POST(req: Request) {
	try {
		//catching id to add to friend from client and validating jwt token
		const body = await req.json();
		const { email: emailToAdd } = addFriendValidator.parse(body.email);
		const RESTResponse = await fetch(
			`${process.env.UPSTASH_REDIS_REST_URL}/get/user:email:${emailToAdd}`,
			{
				headers: {
					Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
				},
				cache: "no-store",
			}
		);
		const response = (await fetchRedis(
			"get",
			`user:email:${emailToAdd}`
		)) as string;
		const data = (await RESTResponse.json()) as { result: string };
		const idToAdd = data.result;
		const session = await getServerSession(authOptions);

		if (!idToAdd) {
			return new Response("this person does not exist ", {
				status: 400,
			});
		}
		//unauthorized request
		if (!session) {
			return new Response("Unauthorized", { status: 401 });
		}
		//adding user themself as a friend
		if (idToAdd === session.user.id) {
			return new Response("You cannot add yourself as a friend", {
				status: 400,
			});
		}
		//check if friend request is already sent
		const isAlreadyAdded = (await fetchRedis(
			"sismember",
			`user:${idToAdd}:incoming_friend_requests`,
			session.user.id
		)) as 0 | 1;
		if (isAlreadyAdded) {
			return new Response("Request to add is already sent ", {
				status: 400,
			});
		}
		//check if user is already added to friend list
		const isAlreadyFriends = (await fetchRedis(
			"sismember",
			`user:${session.user.id}:friends`,
			idToAdd
		)) as 0 | 1;
		if (isAlreadyFriends) {
			return new Response("This user is already your friend", {
				status: 400,
			});
		}
		//valid request, send friend request

		pusherServer.trigger(
			toPusherKey(`user:${idToAdd}:incoming_friend_requests`),
			"incoming_friend_requests",
			{
				senderId: session.user.id,
				senderEmail: session.user.email,
			}
		);

		db.sadd(`user:${idToAdd}:incoming_friend_requests`, session.user.id);
		return new Response("OK");
	} catch (error) {
		if (error instanceof z.ZodError) {
			return new Response("Invalid request payload", { status: 422 });
		}
		return new Response("Invalid request", { status: 400 });
	}
}
