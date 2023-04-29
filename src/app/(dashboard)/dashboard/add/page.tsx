import AddFriendButton from "@/components/AddFriendButton";
import { fetchRedis } from "@/helpers/redis";
import { FC } from "react";

const page: FC = ({}) => {
	async function getAllUsers() {
		const users = await fetchRedis(
			"get",
			"user:account:by-user-id:70280e39-500f-47da-b826-616bc4d03950"
		);
		console.log(users);
	}
	getAllUsers();
	return (
		<main className='pt-8'>
			<h1 className='font-bold text-5xl mb-8 font'>Add a friend</h1>
			<AddFriendButton />
		</main>
	);
};

export default page;
